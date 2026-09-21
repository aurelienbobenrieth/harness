import type { Rule } from "@oxlint/plugins";
import { attribute, elementName, potentiallyNonemptyString } from "../jsx-support.js";

/** @attribution https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/spinner (inspiration; independently implemented) */
export const sSpinnerAccessibleLabel: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require a nonempty accessibilityLabel on Polaris spinners." },
    messages: {
      label:
        "This spinner does not identify its loading operation: set a nonempty accessibilityLabel (Polaris Spinner best practices).",
    },
  },
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        if (elementName(node) !== "s-spinner") return;
        if (potentiallyNonemptyString(attribute(node, "accessibilityLabel"))) return;
        context.report({ node, messageId: "label" });
      },
    };
  },
};
