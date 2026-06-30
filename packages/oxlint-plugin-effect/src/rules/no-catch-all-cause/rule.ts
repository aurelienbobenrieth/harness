import type { ESTree, Rule } from "@oxlint/plugins";
import { isMemberExpression } from "../ast.js";

const message = "Use catchAll, catchTag, or mapError for expected errors instead of catchAllCause.";

function isCatchAllCauseMember(node: ESTree.Node): boolean {
  return isMemberExpression(node, "Effect", "catchAllCause");
}

export const noCatchAllCause: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Effect.catchAllCause because it catches defects.",
    },
    messages: {
      catchAllCause: message,
    },
  },
  createOnce(context) {
    return {
      MemberExpression(node) {
        if (!isCatchAllCauseMember(node)) return;

        context.report({
          node,
          messageId: "catchAllCause",
        });
      },
    };
  },
};
