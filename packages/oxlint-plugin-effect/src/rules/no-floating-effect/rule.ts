import { effectMethod } from "../binding-support.js";
import type { ESTree, Rule, Context } from "@oxlint/plugins";

const message = "Effect values should be yielded, returned, composed, or run at an explicit runtime boundary.";

const runtimeBoundaryCalls = new Set([
  "runCallback",
  "runCallbackWith",
  "runFork",
  "runForkWith",
  "runPromise",
  "runPromiseExit",
  "runPromiseExitWith",
  "runPromiseWith",
  "runSync",
  "runSyncExit",
  "runSyncExitWith",
  "runSyncWith",
]);
function isEffectNamespaceCall(node: ESTree.Node, context: Context): boolean {
  if (node.type !== "CallExpression") return false;
  const method = effectMethod(context, node.callee);
  if (method !== undefined) return !runtimeBoundaryCalls.has(method);
  if (node.callee.type === "CallExpression") {
    const curried = effectMethod(context, node.callee.callee);
    if (curried !== undefined) return !runtimeBoundaryCalls.has(curried);
  }
  if (
    node.callee.type === "MemberExpression" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "pipe"
  )
    return isEffectNamespaceCall(node.callee.object, context);
  if (node.callee.type === "Identifier" && node.callee.name === "pipe" && node.arguments[0] !== undefined)
    return isEffectNamespaceCall(node.arguments[0], context);
  return false;
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
        if (!isEffectNamespaceCall(node.expression, context)) return;

        context.report({
          node,
          messageId: "noFloatingEffect",
        });
      },
    };
  },
};
