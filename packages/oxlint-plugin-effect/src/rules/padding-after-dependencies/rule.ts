/**
 * Require a blank line between the leading run of service dependencies in an
 * Effect generator body and the first statement of logic below them.
 */
import { statementPadding } from "@aurelienbbn/oxlint-kit/padding";
import type { ESTree, Rule } from "@oxlint/plugins";
import { effectBodyMethod, isServiceDependency } from "../binding-support.js";

export const paddingAfterDependencies: Rule = {
  meta: {
    type: "layout",
    docs: {
      description:
        "Require a blank line after the leading service dependencies of an Effect.gen, Effect.fn, or Effect.fnUntraced generator body when logic follows them.",
    },
    fixable: "whitespace",
    messages: {
      padding: "Separate the service dependencies from the logic below them with a blank line.",
    },
    schema: [],
  },
  createOnce(context) {
    const check = (node: ESTree.Function): void => {
      if (!node.generator || node.body === null || effectBodyMethod(context, node) === undefined) return;
      const statements = node.body.body;
      const logicIndex = statements.findIndex((statement) => !isServiceDependency(context, statement));
      const lastDependency = statements[logicIndex - 1];
      const logic = statements[logicIndex];
      if (lastDependency === undefined || logic === undefined) return;
      const gap = statementPadding(context.sourceCode, lastDependency, logic);
      if (gap.padded) return;
      context.report({
        node: lastDependency,
        messageId: "padding",
        fix: (fixer) => fixer.replaceTextRange(gap.range, gap.text),
      });
    };

    return { FunctionDeclaration: check, FunctionExpression: check };
  },
};
