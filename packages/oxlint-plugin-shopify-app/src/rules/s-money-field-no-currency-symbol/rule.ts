import type { Rule } from "@oxlint/plugins";
import { attribute, elementName } from "../jsx-support.js";

/** @attribution https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field (inspiration; independently implemented) */
export const sMoneyFieldNoCurrencySymbol: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow literal currency symbols in Polaris money-field labels and placeholders, whose currency formatting is component-owned.",
    },
    messages: {
      symbol:
        "This money-field label or placeholder duplicates currency formatting: remove the currency symbol and name the amount's purpose (Polaris Money field best practices).",
    },
  },
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        if (elementName(node) !== "s-money-field") return;
        if (
          ["label", "placeholder"].some((name) => {
            const value = attribute(node, name);
            return value.kind === "known" && typeof value.value === "string" && /\p{Sc}/u.test(value.value);
          })
        )
          context.report({ node, messageId: "symbol" });
      },
    };
  },
};
