import type { Rule } from "@oxlint/plugins";
import { attribute, elementName, potentiallyNamedChildren, potentiallyNonemptyString } from "../jsx-support.js";

/** @attribution https://shopify.dev/docs/api/app-home/latest/web-components/actions/button (inspiration; independently implemented) */
export const sButtonAccessibleName: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require an accessibilityLabel on statically unnamed Polaris buttons, including icon-only buttons.",
    },
    messages: {
      name: "This Polaris button has no readable action name: add text content or a nonempty accessibilityLabel (Polaris Button best practices).",
    },
  },
  createOnce(context) {
    return {
      JSXElement(node) {
        if (elementName(node.openingElement) !== "s-button") return;
        if (potentiallyNamedChildren(node)) return;
        if (potentiallyNonemptyString(attribute(node.openingElement, "accessibilityLabel"))) return;
        if (potentiallyNonemptyString(attribute(node.openingElement, "children"))) return;
        context.report({ node: node.openingElement, messageId: "name" });
      },
    };
  },
};
