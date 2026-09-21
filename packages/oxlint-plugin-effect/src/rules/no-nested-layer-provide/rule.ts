/**
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import type { Rule } from "@oxlint/plugins";
import { isLayerProvisionCall } from "../effect-modules.js";

const message =
  "Do not nest Layer.provide calls inside another Layer.provide. Extract and name the configured layer, or use a single provision step.";

export const noNestedLayerProvide: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow Layer.provide calls nested inside another Layer.provide call.",
    },
    messages: {
      nestedLayerProvide: message,
    },
  },
  createOnce(context) {
    let depth = 0;
    return {
      before() {
        depth = 0;
      },
      CallExpression(node) {
        if (!isLayerProvisionCall(node)) return;
        if (depth > 0) context.report({ node, messageId: "nestedLayerProvide" });
        depth += 1;
      },
      "CallExpression:exit"(node) {
        if (isLayerProvisionCall(node)) depth -= 1;
      },
    };
  },
};
