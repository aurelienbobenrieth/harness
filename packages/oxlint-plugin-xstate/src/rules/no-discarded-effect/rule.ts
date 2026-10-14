/**
 * Forbid building an Effect where XState v6 throws it away: inside an inline
 * `enq(() => ...)` effect, or as the return value of a machine handler.
 *
 * @attribution statelyai/xstate no-inline-effect (MIT; concept, independently implemented)
 */
import { isFunctionNode, returnedExpressions, unwrapExpressionKeepingChain } from "@aurelienbbn/oxlint-kit/ast";
import { enqueueHandler, isConfigHandler, isEffectExpression } from "../v6-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const inlineMessage =
  "enq(() => Effect...) builds an Effect that XState discards without running it. Register the Effect as a named action in setupEffect({ actions }) and enqueue it with enq(actions.name, params), or run it in fromEffect logic.";

const returnedMessage =
  "A machine handler returns its transition result, not work to run: this Effect is discarded without running. Register it in setupEffect({ actions }) and enqueue it with enq(actions.name, params).";

function reportEffects(context: Context, fn: ESTree.Node, messageId: "inlineEffect" | "returnedEffect"): void {
  if (!isFunctionNode(fn)) return;
  for (const returned of returnedExpressions(fn))
    if (isEffectExpression(context, returned)) context.report({ node: returned, messageId });
}

export const noDiscardedEffect: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid Effects built inside an inline enq(() => ...) effect or returned from a machine handler, where XState discards them unrun.",
    },
    messages: {
      inlineEffect: inlineMessage,
      returnedEffect: returnedMessage,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = unwrapExpressionKeepingChain(node.callee);
        if (callee.type !== "Identifier" || enqueueHandler(context, callee) === undefined) return;
        const effect = node.arguments[0];
        if (effect !== undefined) reportEffects(context, unwrapExpressionKeepingChain(effect), "inlineEffect");
      },
      ArrowFunctionExpression(node) {
        if (isConfigHandler(context, node)) reportEffects(context, node, "returnedEffect");
      },
      FunctionExpression(node) {
        if (isConfigHandler(context, node)) reportEffects(context, node, "returnedEffect");
      },
    };
  },
};
