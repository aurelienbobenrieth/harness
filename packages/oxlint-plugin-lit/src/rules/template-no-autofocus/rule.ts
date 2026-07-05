import type { Rule } from "@oxlint/plugins";
import { litTemplateText } from "../template-support.js";

const message = "autofocus steals focus and disorients assistive technology users: remove it.";

const autofocusPattern = /<[a-z][^>]*\sautofocus(?:[\s=/>])/i;

export const templateNoAutofocus: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the autofocus attribute inside Lit html templates.",
    },
    messages: {
      templateNoAutofocus: message,
    },
  },
  createOnce(context) {
    return {
      TaggedTemplateExpression(node) {
        const templateText = litTemplateText(node);
        if (templateText === undefined) return;
        if (!autofocusPattern.test(templateText)) return;
        context.report({ node, messageId: "templateNoAutofocus" });
      },
    };
  },
};
