import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Draft orders must not carry custom discounts: use discount functions or native discount APIs instead (BFS 5.5.2).";

import { mutationFields, hasInputField } from "../graphql-support.js";

function textFromTemplate(node: ESTree.TemplateLiteral): string {
  return node.quasis.map((quasi) => quasi.value.raw).join("");
}

function reportsOnText(text: string): boolean {
  return mutationFields(text).some(
    (field) =>
      ["draftOrderCreate", "draftOrderUpdate", "draftOrderCalculate"].includes(field.name.value) &&
      hasInputField(field, "appliedDiscount"),
  );
}

export const noDraftOrderCustomDiscounts: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow draft order mutations that apply custom discounts.",
    },
    messages: {
      noDraftOrderCustomDiscounts: message,
    },
  },
  createOnce(context) {
    return {
      TemplateLiteral(node) {
        if (!reportsOnText(textFromTemplate(node))) return;
        context.report({ node, messageId: "noDraftOrderCustomDiscounts" });
      },
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (!reportsOnText(node.value)) return;
        context.report({ node, messageId: "noDraftOrderCustomDiscounts" });
      },
    };
  },
};
