import type { ESTree, Rule } from "@oxlint/plugins";
import { isIdentifier, isMemberExpression } from "../ast.js";

const message = "Provide an explicit concurrency option for Effect.forEach.";

function hasConcurrencyOption(node: ESTree.Node | undefined): boolean {
  if (node?.type !== "ObjectExpression") return false;

  return node.properties.some((property) => {
    if (property.type !== "Property") return false;

    const key = property.key;
    return isIdentifier(key, "concurrency") || (key.type === "Literal" && key.value === "concurrency");
  });
}

function isEffectForEachCall(node: ESTree.Node): node is ESTree.CallExpression {
  return node.type === "CallExpression" && isMemberExpression(node.callee, "Effect", "forEach");
}

export const requireForEachConcurrency: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require explicit concurrency for Effect.forEach.",
    },
    messages: {
      explicitConcurrency: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isEffectForEachCall(node)) return;
        if (hasConcurrencyOption(node.arguments[2])) return;

        context.report({
          node,
          messageId: "explicitConcurrency",
        });
      },
    };
  },
};
