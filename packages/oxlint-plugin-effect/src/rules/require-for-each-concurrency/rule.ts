import { effectMethod } from "../binding-support.js";
import type { ESTree, Rule, Context } from "@oxlint/plugins";
import { hasPropertyNamed } from "../ast.js";
import { allowOptionDefaults, allowOptionSchema, isExemptFile } from "../test-paths.js";

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
    schema: [allowOptionSchema],
    defaultOptions: allowOptionDefaults,
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isEffectForEachCall(node, context)) return;
        if (hasPropertyNamed(node.arguments.at(-1), "concurrency")) return;

        if (isExemptFile(context)) return;

        context.report({
          node,
          messageId: "explicitConcurrency",
        });
      },
    };
  },
};
