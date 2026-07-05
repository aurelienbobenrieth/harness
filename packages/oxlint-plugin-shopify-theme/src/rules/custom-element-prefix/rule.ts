import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Public custom elements share one global registry with apps and other scripts: use the configured namespace prefix to avoid collisions.";

type RuleOptions = { readonly prefix?: string };

function configuredPrefix(context: unknown): string {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first === "object" && first !== null) {
    const prefix = (first as RuleOptions).prefix;
    if (typeof prefix === "string" && prefix.length > 0) return prefix;
  }
  return "oio";
}

function isCustomElementsDefine(callee: ESTree.Expression | ESTree.Super): boolean {
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  if (callee.property.type !== "Identifier" || callee.property.name !== "define") return false;
  const object = callee.object;
  if (object.type === "Identifier") return object.name === "customElements";
  if (object.type === "MemberExpression" && !object.computed) {
    return object.property.type === "Identifier" && object.property.name === "customElements";
  }
  return false;
}

export const customElementPrefix: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require registered custom element names to use the theme namespace prefix.",
    },
    messages: {
      customElementPrefix: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          prefix: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isCustomElementsDefine(node.callee)) return;
        const nameArgument = node.arguments[0];
        if (nameArgument === undefined || nameArgument.type !== "Literal") return;
        const name = nameArgument.value;
        if (typeof name !== "string") return;
        if (name.startsWith(`${configuredPrefix(context)}-`)) return;
        context.report({ node: nameArgument, messageId: "customElementPrefix" });
      },
    };
  },
};
