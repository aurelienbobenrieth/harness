import { propertyKeyName } from "@aurelienbbn/oxlint-kit/ast";
import type { Rule } from "@oxlint/plugins";
import { moduleMethod } from "../binding-support.js";

export const destructiveReasonRequired: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require a nonoptional refined reason in Delete, Destroy, Purge, Drop and Remove command Schema.Struct declarations.",
    },
    messages: {
      reason:
        "Require a validated reason for this destructive command; reject trimmed reasons shorter than 10 characters before deletion.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (moduleMethod(context, node.callee, "Schema") !== "Struct") return;
        const parent = node.parent;
        if (
          parent?.type !== "VariableDeclarator" ||
          parent.id.type !== "Identifier" ||
          !/^(?:Delete|Destroy|Purge|Drop|Remove)[A-Z_]/.test(parent.id.name)
        )
          return;
        const fields = node.arguments[0];
        if (
          fields?.type !== "ObjectExpression" ||
          fields.properties.some((property) => property.type === "SpreadElement")
        )
          return;
        const reason = fields.properties.find(
          (property) => property.type === "Property" && propertyKeyName(property) === "reason",
        );
        if (reason?.type === "Property") {
          const value = reason.value;
          if (value.type === "Identifier") return;
          const text = context.sourceCode.getText(value);
          if (
            !/\boptional(?:Key)?\s*\(/.test(text) &&
            /\b(?:check|filter)\s*\(/.test(text) &&
            /\.trim\(\)\.length\s*(?:>=\s*10\b|>\s*9\b)/.test(text)
          )
            return;
        }
        context.report({ node, messageId: "reason" });
      },
    };
  },
};
