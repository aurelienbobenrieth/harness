import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Script tags are deprecated and stop running on 2027-03-01 (shopify.dev/changelog/online-store-script-tags-deprecation): migrate tracking to Web Pixel extensions and storefront UI to theme app extensions (BFS 5.1, 3.2.1).";

import { mutationFields } from "../graphql-support.js";
function prohibited(text: string): boolean {
  return mutationFields(text).some((field) => ["scriptTagCreate", "scriptTagUpdate"].includes(field.name.value));
}
const scriptTagImportPattern = /ScriptTagCreate|ScriptTagUpdate/;

function textFromTemplate(node: ESTree.TemplateLiteral): string {
  return node.quasis.map((quasi) => quasi.value.raw).join("");
}

/**
 * @attribution https://shopify.dev/changelog/online-store-script-tags-deprecation (inspiration; independently implemented)
 */
export const noScriptTagApi: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow the Script Tag API, which stops running on 2027-03-01, in favor of Web Pixel and theme app extensions.",
    },
    messages: {
      noScriptTagApi: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const argument = node.arguments[0];
        const text =
          argument?.type === "Literal" && typeof argument.value === "string"
            ? argument.value
            : argument?.type === "TemplateLiteral"
              ? textFromTemplate(argument)
              : "";
        const request =
          node.callee.type === "Identifier"
            ? node.callee.name === "fetch"
            : node.callee.type === "MemberExpression" &&
              node.callee.property.type === "Identifier" &&
              ["get", "post", "put", "delete", "request"].includes(node.callee.property.name);
        if (request && /\/script_tags(?:\.json|\/|$)/.test(text)) context.report({ node, messageId: "noScriptTagApi" });
      },
      TemplateLiteral(node) {
        if (!prohibited(textFromTemplate(node))) return;
        context.report({ node, messageId: "noScriptTagApi" });
      },
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (!prohibited(node.value)) return;
        context.report({ node, messageId: "noScriptTagApi" });
      },
      ImportSpecifier(node) {
        const declaration = node.parent;
        if (
          declaration.type !== "ImportDeclaration" ||
          !/generated|@shopify\//.test(String(declaration.source.value)) ||
          declaration.importKind === "type" ||
          node.importKind === "type"
        )
          return;
        const imported = node.imported;
        const importedName = imported.type === "Identifier" ? imported.name : String(imported.value);
        if (!scriptTagImportPattern.test(importedName)) return;
        context.report({ node, messageId: "noScriptTagApi" });
      },
    };
  },
};
