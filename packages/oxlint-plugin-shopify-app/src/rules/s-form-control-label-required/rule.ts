import type { Rule } from "@oxlint/plugins";
import { attribute, elementName, potentiallyNonemptyString } from "../jsx-support.js";

const controls = new Set([
  "s-text-field",
  "s-email-field",
  "s-url-field",
  "s-password-field",
  "s-search-field",
  "s-number-field",
  "s-money-field",
  "s-text-area",
  "s-select",
  "s-checkbox",
  "s-switch",
  "s-choice-list",
  "s-date-field",
  "s-color-field",
  "s-drop-zone",
]);
const accessibilityLabelControls = new Set(["s-switch", "s-drop-zone"]);

/**
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/api/app-home/latest/web-components/forms/drop-zone (inspiration; independently implemented)
 */
export const sFormControlLabelRequired: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require labels on Polaris form fields; switch and drop zone may use their documented accessibilityLabel alternative.",
    },
    messages: {
      label:
        "This Polaris control has no label: supply a nonempty label; use labelAccessibilityVisibility=exclusive when it should be visually hidden (Polaris Forms accessibility).",
    },
  },
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        const name = elementName(node);
        if (name === undefined || !controls.has(name)) return;
        if (potentiallyNonemptyString(attribute(node, "label"))) return;
        if (accessibilityLabelControls.has(name) && potentiallyNonemptyString(attribute(node, "accessibilityLabel")))
          return;
        context.report({ node, messageId: "label" });
      },
    };
  },
};
