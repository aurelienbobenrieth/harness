import type { Rule } from "@oxlint/plugins";
import { isEffectBody, nearestFunction } from "../sota-support.js";

const message =
  "Delegate with yield* inside Effect generators: a plain yield hands the Effect to the runner unexecuted and types the result as any.";

/**
 * Require `yield*` for every yield inside `Effect.gen`, `Effect.fn` and `Effect.fnUntraced` generators.
 *
 * @attribution @effect/language-service missingStarInYieldEffectGen diagnostic (concept)
 */
export const noPlainYield: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow yield without * inside Effect.gen, Effect.fn, and Effect.fnUntraced generators.",
    },
    fixable: "code",
    messages: { noPlainYield: message },
  },
  createOnce(context) {
    return {
      YieldExpression(node) {
        if (node.delegate) return;
        const owner = nearestFunction(node);
        if (owner === undefined || !isEffectBody(owner, context)) return;

        const keywordEnd = node.range[0] + "yield".length;
        context.report({
          node,
          messageId: "noPlainYield",
          fix: (fixer) => fixer.insertTextAfterRange([node.range[0], keywordEnd], "*"),
        });
      },
    };
  },
};
