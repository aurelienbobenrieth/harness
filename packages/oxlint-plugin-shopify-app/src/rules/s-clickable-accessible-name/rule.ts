import type { Rule } from "@oxlint/plugins";
import { attribute, elementName, potentiallyNamedChildren, potentiallyNonemptyString } from "../jsx-support.js";

/** @attribution https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable (inspiration; independently implemented) */
export const sClickableAccessibleName: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require accessibilityLabel on Polaris clickable components without statically readable content.",
    },
    messages: {
      name: "This clickable has no readable action name: add text content or a nonempty accessibilityLabel (Polaris Clickable best practices).",
    },
  },
  createOnce(context) {
    return {
      JSXElement(node) {
        if (elementName(node.openingElement) !== "s-clickable") return;
        if (potentiallyNamedChildren(node)) return;
        if (potentiallyNonemptyString(attribute(node.openingElement, "accessibilityLabel"))) return;
        if (potentiallyNonemptyString(attribute(node.openingElement, "children"))) return;
        context.report({ node: node.openingElement, messageId: "name" });
      },
    };
  },
};
