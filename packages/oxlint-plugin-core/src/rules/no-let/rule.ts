import type { Rule } from "@oxlint/plugins";

const message = "Express the value without reassignment: use const, extract a function, or build it in one expression.";

export const noLet: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow let and var declarations in favor of const and expression-oriented code.",
    },
    messages: {
      noLet: message,
    },
  },
  createOnce(context) {
    return {
      VariableDeclaration(node) {
        if (node.kind !== "let" && node.kind !== "var") return;
        context.report({ node, messageId: "noLet" });
      },
    };
  },
};
