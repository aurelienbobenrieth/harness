import type { ESTree, Rule } from "@oxlint/plugins";
import { isMemberExpression } from "../ast.js";

const message = "Effect values should be yielded, returned, composed, or run at an explicit runtime boundary.";

const runtimeBoundaryCalls = new Set(["runCallback", "runFork", "runPromise", "runSync"]);
const allowedStandaloneCalls = new Set([
  "log",
  "logDebug",
  "logError",
  "logFatal",
  "logInfo",
  "logTrace",
  "logWarning",
]);

function isEffectNamespaceCall(node: ESTree.Node): node is ESTree.CallExpression {
  if (node.type !== "CallExpression") return false;
  if (node.callee.type !== "MemberExpression") return false;
  if (node.callee.object.type !== "Identifier" || node.callee.object.name !== "Effect") return false;
  if (node.callee.property.type !== "Identifier") return false;

  return !runtimeBoundaryCalls.has(node.callee.property.name);
}

function isAllowedFloatingEffect(node: ESTree.CallExpression): boolean {
  return Array.from(allowedStandaloneCalls).some((methodName) => isMemberExpression(node.callee, "Effect", methodName));
}

export const noFloatingEffect: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow standalone Effect values that are created and ignored.",
    },
    messages: {
      noFloatingEffect: message,
    },
  },
  createOnce(context) {
    return {
      ExpressionStatement(node: ESTree.ExpressionStatement) {
        if (!isEffectNamespaceCall(node.expression)) return;
        if (isAllowedFloatingEffect(node.expression)) return;

        context.report({
          node,
          messageId: "noFloatingEffect",
        });
      },
    };
  },
};
