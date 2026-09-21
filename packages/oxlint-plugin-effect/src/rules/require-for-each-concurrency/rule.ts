import { effectMethod } from "../binding-support.js";
import type { ESTree, Rule, Context } from "@oxlint/plugins";
import { hasPropertyNamed } from "../ast.js";

const message = "Provide an explicit concurrency option for Effect.forEach.";

function isEffectForEachCall(node: ESTree.Node, context: Context): node is ESTree.CallExpression {
  return node.type === "CallExpression" && effectMethod(context, node.callee) === "forEach";
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
        if (!isEffectForEachCall(node, context)) return;
        if (hasPropertyNamed(node.arguments.at(-1), "concurrency")) return;

        context.report({
          node,
          messageId: "explicitConcurrency",
        });
      },
    };
  },
};
