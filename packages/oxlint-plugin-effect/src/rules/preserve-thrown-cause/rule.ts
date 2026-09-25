import type { Rule } from "@oxlint/plugins";
import { isFunctionNode } from "@aurelienbbn/oxlint-kit/ast";
import { effectMethod } from "../binding-support.js";
import { ignoresFirstParameter, propertyNamed } from "../sota-support.js";

const message =
  "Keep the thrown value: accept the catch parameter and store it on the typed error (for example as a cause field) so the original failure and stack survive.";

/**
 * Require `Effect.try` / `Effect.tryPromise` catch mappers to use the thrown value they receive.
 *
 * @attribution Effect bundled ai-docs `catch: (cause) => new X({ cause })` convention (concept)
 */
export const preserveThrownCause: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require Effect.try and Effect.tryPromise catch mappers to use the thrown value they receive.",
    },
    messages: { preserveThrownCause: message },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const method = effectMethod(context, node.callee);
        if (method !== "try" && method !== "tryPromise") return;

        const mapper = propertyNamed(node.arguments[0], "catch")?.value;
        if (!isFunctionNode(mapper) || !ignoresFirstParameter(context, mapper)) return;

        context.report({ node: mapper, messageId: "preserveThrownCause" });
      },
    };
  },
};
