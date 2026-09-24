import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { effectMethod, moduleMethod } from "../binding-support.js";

const message =
  "Handle expected errors with Effect.catch (catchAll in Effect 3), catchTag, or mapError; cause-level handlers also catch defects and interruption.";
const sandboxMessage =
  "Effect.sandbox moves the full Cause into the error channel, so the next catch also handles defects. Handle expected errors with Effect.catch, catchTag, or mapError.";
const ignoreCauseMessage =
  "Effect.ignoreCause discards defects and interruption along with expected errors. Use Effect.ignore({ log: true }) for expected errors and let defects surface.";
const catchDefectMessage =
  "Effect.catchDefect recovers from defects, which signal bugs. Fix the defect at its source; at a genuine plugin or integration boundary, suppress this line with the reason.";

const effectCauseHandlers = new Set(["catchAllCause", "catchCause", "catchCauseIf", "catchCauseFilter"]);

type MessageId = "catchAllCause" | "catchDefect" | "ignoreCause" | "sandbox";

function causeHandlerMessageId(context: Context, node: ESTree.Node): MessageId | undefined {
  const method = effectMethod(context, node);
  if (method === "sandbox" || method === "ignoreCause" || method === "catchDefect") return method;
  if (method !== undefined && effectCauseHandlers.has(method)) return "catchAllCause";
  return moduleMethod(context, node, "Layer") === "catchCause" ? "catchAllCause" : undefined;
}

export const noCatchAllCause: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.catchCause, catchCauseIf, catchCauseFilter, catchDefect, ignoreCause, sandbox, Layer.catchCause, and Effect 3 catchAllCause because they catch defects.",
    },
    messages: {
      catchAllCause: message,
      catchDefect: catchDefectMessage,
      ignoreCause: ignoreCauseMessage,
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
