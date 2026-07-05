import type { Rule } from "@oxlint/plugins";
import { litTemplateText } from "../template-support.js";

const message = "Positive tabindex values break natural focus order: use 0 or -1.";

const positiveTabindexPattern = /\btabindex\s*=\s*["']?[1-9]/i;

export const templateNoPositiveTabindex: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow positive tabindex values inside Lit html templates.",
    },
    messages: {
      templateNoPositiveTabindex: message,
    },
  },
  createOnce(context) {
    return {
      TaggedTemplateExpression(node) {
        const templateText = litTemplateText(node);
        if (templateText === undefined) return;
        if (!positiveTabindexPattern.test(templateText)) return;
        context.report({ node, messageId: "templateNoPositiveTabindex" });
      },
    };
  },
};
