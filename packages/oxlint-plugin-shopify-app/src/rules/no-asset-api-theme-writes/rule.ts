import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Writing theme files from an app is prohibited outside exempted categories: ship storefront changes as theme app extensions (BFS 3.2.2).";

import { mutationFields } from "../graphql-support.js";
const restAssetWritePattern = /\/themes\/[^"'`\s]*\/assets/;

function textFromTemplate(node: ESTree.TemplateLiteral): string {
  return node.quasis.map((quasi) => quasi.value.raw).join("");
}

function reportsOnText(text: string): boolean {
  return mutationFields(text).some((field) =>
    ["themeFilesUpsert", "themeFilesDelete", "themeFilesCopy"].includes(field.name.value),
  );
}

export const noAssetApiThemeWrites: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow theme file writes through the Asset API or theme file mutations.",
    },
    messages: {
      noAssetApiThemeWrites: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const url = node.arguments[0];
        const text =
          url?.type === "Literal" && typeof url.value === "string"
            ? url.value
            : url?.type === "TemplateLiteral"
              ? textFromTemplate(url)
              : "";
        if (!restAssetWritePattern.test(text)) return;
        const options = node.arguments[1];
        const methodProperty =
          options?.type === "ObjectExpression"
            ? options.properties.find(
                (property) =>
                  property.type === "Property" &&
                  !property.computed &&
                  ((property.key.type === "Identifier" && property.key.name === "method") ||
                    (property.key.type === "Literal" && property.key.value === "method")),
              )
            : undefined;
        const method =
          methodProperty?.type === "Property" && methodProperty.value.type === "Literal"
            ? String(methodProperty.value.value).toUpperCase()
            : node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier"
              ? node.callee.property.name.toUpperCase()
              : "GET";
        if (!["PUT", "POST", "PATCH", "DELETE"].includes(method)) return;
        context.report({ node, messageId: "noAssetApiThemeWrites" });
      },
      TemplateLiteral(node) {
        if (!reportsOnText(textFromTemplate(node))) return;
        context.report({ node, messageId: "noAssetApiThemeWrites" });
      },
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (!reportsOnText(node.value)) return;
        context.report({ node, messageId: "noAssetApiThemeWrites" });
      },
    };
  },
};
