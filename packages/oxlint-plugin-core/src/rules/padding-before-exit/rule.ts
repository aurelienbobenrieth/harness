/**
 * Require a blank line between a `return` or `throw` and the statement before it
 * in the same statement list. The first statement of a list is exempt, and a
 * comment block directly above the exit belongs to it.
 *
 * @attribution https://eslint.org/docs/latest/rules/padding-line-between-statements (MIT; concept, independently implemented)
 */
import { statementPadding } from "@aurelienbbn/oxlint-kit/padding";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

function checkStatements(context: Context, statements: readonly ESTree.Node[]): void {
  for (const [index, statement] of statements.entries()) {
    const previous = statements[index - 1];
    if (previous === undefined || (statement.type !== "ReturnStatement" && statement.type !== "ThrowStatement"))
      continue;
    const gap = statementPadding(context.sourceCode, previous, statement);
    if (gap.padded) continue;
    context.report({
      node: statement,
      messageId: "padding",
      fix: (fixer) => fixer.replaceTextRange(gap.range, gap.text),
    });
  }
}

export const paddingBeforeExit: Rule = {
  meta: {
    type: "layout",
    docs: {
      description:
        "Require a blank line before a return or throw statement that follows another statement in the same block, switch case, or program body.",
    },
    fixable: "whitespace",
    messages: {
      padding: "Separate this return/throw from the statements above it with a blank line.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      Program: (node) => checkStatements(context, node.body),
      BlockStatement: (node) => checkStatements(context, node.body),
      StaticBlock: (node) => checkStatements(context, node.body),
      SwitchCase: (node) => checkStatements(context, node.consequent),
    };
  },
};
