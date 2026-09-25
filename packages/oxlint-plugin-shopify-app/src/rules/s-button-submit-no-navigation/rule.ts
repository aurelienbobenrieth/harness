import type { Rule } from "@oxlint/plugins";
import { attribute, elementName } from "../jsx-support.js";

/** @attribution https://shopify.dev/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-type (inspiration; independently implemented) */
export const sButtonSubmitNoNavigation: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow static href or commandFor values that override a Polaris button's submit or reset behavior.",
    },
    messages: {
      ignored:
        "This button's form type is ignored because href or commandFor takes precedence: separate form submission/reset from navigation or commands (Polaris Button type).",
    },
  },
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        if (elementName(node) !== "s-button") return;
        const type = attribute(node, "type");
        if (type.kind !== "known" || (type.value !== "submit" && type.value !== "reset")) return;
        if (
          !["href", "commandFor"].some((name) => {
            const value = attribute(node, name);
            return value.kind === "known" && typeof value.value === "string" && value.value !== "";
          })
        )
          return;
        context.report({ node, messageId: "ignored" });
      },
    };
  },
};
