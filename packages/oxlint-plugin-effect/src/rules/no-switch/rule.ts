/**
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { hasEffectImport } from "../effect-modules.js";

const message = "Switch statements are banned in Effect code. Use Match from effect.";

export const noSwitch: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow switch statements in Effect code in favor of Match.",
    },
    messages: {
      noSwitch: message,
    },
  },
  createOnce(context) {
    let fileImportsEffect = false;

    return {
      Program(node: ESTree.Program) {
        fileImportsEffect = hasEffectImport(node);
      },
      SwitchStatement(node) {
        if (!fileImportsEffect) return;

        context.report({ node, messageId: "noSwitch" });
      },
    };
  },
};
