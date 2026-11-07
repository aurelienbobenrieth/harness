import { effectMethod } from "../binding-support.js";
import type { ESTree, Rule, Context } from "@oxlint/plugins";
import { hasPropertyNamed } from "../ast.js";
import { allowOptionDefaults, allowOptionSchema, isExemptFile } from "../test-paths.js";

const message = "Provide an explicit concurrency option for Effect.all.";

function isEffectAllCall(node: ESTree.Node, context: Context): node is ESTree.CallExpression {
  return node.type === "CallExpression" && effectMethod(context, node.callee) === "all";
}

export const requireAllConcurrency: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require explicit concurrency for Effect.all.",
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
        if (!isEffectAllCall(node, context)) return;
        if (hasPropertyNamed(node.arguments[1], "concurrency")) return;

        if (isExemptFile(context)) return;

        context.report({
          node,
          messageId: "explicitConcurrency",
        });
      },
    };
  },
};
