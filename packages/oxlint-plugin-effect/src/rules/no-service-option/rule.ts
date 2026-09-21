/**
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import type { Rule } from "@oxlint/plugins";
import { moduleMethod } from "../binding-support.js";

const message = "Do not use Effect.serviceOption. Require the service directly and provide it in the layer.";

export const noServiceOption: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Effect.serviceOption in favor of required services provided by layers.",
    },
    messages: {
      noServiceOption: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (moduleMethod(context, node.callee, "Effect") !== "serviceOption") return;

        context.report({ node, messageId: "noServiceOption" });
      },
    };
  },
};
