import { importedNameFrom } from "@aurelienbbn/oxlint-kit/ast";
import type { Rule } from "@oxlint/plugins";

export const requireRetentionComment: Rule = {
  meta: {
    type: "suggestion",
    docs: { description: "Document each pgTable retention policy in adjacent @retention JSDoc." },
    messages: {
      retention: "Add adjacent JSDoc with @retention and the table's retention or deletion policy.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (importedNameFrom(context, node.callee, ["drizzle-orm/pg-core"]) !== "pgTable") return;
        let declaration = node.parent;
        while (declaration?.parent && declaration.type !== "VariableDeclaration") declaration = declaration.parent;
        if (declaration?.parent?.type === "ExportNamedDeclaration") declaration = declaration.parent;
        const comment = declaration && context.sourceCode.getCommentsBefore(declaration).at(-1);
        if (
          comment?.type === "Block" &&
          comment.value.startsWith("*") &&
          /@retention\s+[^\s*][^\n]*/.test(comment.value) &&
          context.sourceCode.text.slice(comment.range[1], declaration.range[0]).trim() === ""
        )
          return;
        context.report({ node, messageId: "retention" });
      },
    };
  },
};
