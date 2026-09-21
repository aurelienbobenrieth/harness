import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { effectMethod, moduleMethod } from "../binding-support.js";

const message =
  "Handle expected errors with Effect.catch (catchAll in Effect 3), catchTag, or mapError; cause-level handlers also catch defects and interruption.";
const sandboxMessage =
  "Effect.sandbox moves the full Cause into the error channel, so the next catch also handles defects. Handle expected errors with Effect.catch, catchTag, or mapError.";

const effectCauseHandlers = new Set(["catchAllCause", "catchCause", "catchCauseIf", "catchCauseFilter"]);

function causeHandlerMessageId(context: Context, node: ESTree.Node): "catchAllCause" | "sandbox" | undefined {
  const method = effectMethod(context, node);
  if (method === "sandbox") return "sandbox";
  if (method !== undefined && effectCauseHandlers.has(method)) return "catchAllCause";
  return moduleMethod(context, node, "Layer") === "catchCause" ? "catchAllCause" : undefined;
}

export const noCatchAllCause: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.catchCause, catchCauseIf, catchCauseFilter, sandbox, Layer.catchCause, and Effect 3 catchAllCause because they catch defects.",
    },
    messages: {
      catchAllCause: message,
      sandbox: sandboxMessage,
    },
  },
  createOnce(context) {
    return {
      MemberExpression(node) {
        const messageId = causeHandlerMessageId(context, node);
        if (messageId === undefined) return;

        context.report({
          node,
          messageId,
        });
      },
    };
  },
};
