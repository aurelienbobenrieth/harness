/**
 * Require or disallow a blank line between two sibling statements, configured the way ESLint's rule of the same name
 * is: a list of `{ blankLine, prev, next }` options, the last one matching both statements wins. A comment block
 * above a statement belongs to it, so the blank line goes above the comments. Without options the rule applies
 * {@link recommendedPadding}.
 *
 * @attribution https://eslint.org/docs/latest/rules/padding-line-between-statements (MIT; option schema and statement types, independently implemented)
 */
import { statementPadding, statementUnpadding } from "@aurelienbbn/oxlint-kit/padding";
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { matchesAny, statementTypes } from "./statement-types.js";

type BlankLine = "any" | "never" | "always";

type Padding = {
  readonly blankLine: BlankLine;
  readonly prev: string | readonly string[];
  readonly next: string | readonly string[];
};

/**
 * What the rule applies without options: a blank line around blocks and multiline expressions, after a run of
 * `const`/`let` declarations (declarations in a row stay free), and before `return` and `throw`.
 */
const recommendedPadding: readonly Padding[] = [
  { blankLine: "always", prev: "*", next: ["block-like", "multiline-expression"] },
  { blankLine: "always", prev: ["block-like", "multiline-expression"], next: "*" },
  { blankLine: "always", prev: ["const", "let"], next: "*" },
  { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
  { blankLine: "always", prev: "*", next: ["return", "throw"] },
];

const statementType = {
  anyOf: [
    { enum: [...statementTypes] },
    { type: "array" as const, items: { enum: [...statementTypes] }, minItems: 1, uniqueItems: true },
  ],
};

const listOf = (types: string | readonly string[]): readonly string[] => (typeof types === "string" ? [types] : types);

/** Oxlint validates the options against the schema before the rule runs, so every entry is a {@link Padding}. */
function paddingsOf(context: Context): readonly Padding[] {
  const options = context.options as readonly Padding[];
  return options.length === 0 ? recommendedPadding : options;
}

/** ESLint checks the nodes whose type ends in Statement or Declaration, and switch cases. */
const isStatement = (node: ESTree.Node): boolean =>
  node.type === "SwitchCase" || /(?:Statement|Declaration)$/.test(node.type);

export const paddingLineBetweenStatements: Rule = {
  meta: {
    type: "layout",
    docs: {
      description:
        "Require or disallow blank lines between statements, with ESLint's options and a comment block counted as part of the statement below it; defaults to padding blocks, multiline expressions, declaration runs, and exits.",
    },
    fixable: "whitespace",
    messages: {
      padding: "Add a blank line above this statement and its leading comments.",
      noPadding: "Remove the blank lines between this statement and the one above it.",
    },
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          blankLine: { enum: ["any", "never", "always"] },
          prev: statementType,
          next: statementType,
        },
        required: ["blankLine", "prev", "next"],
        additionalProperties: false,
      },
    },
  },
  create(context) {
    const paddings = paddingsOf(context);
    const { sourceCode } = context;

    const blankLineBetween = (previous: ESTree.Node, next: ESTree.Node): BlankLine =>
      paddings.findLast(
        (padding) =>
          matchesAny(previous, listOf(padding.prev), sourceCode) && matchesAny(next, listOf(padding.next), sourceCode),
      )?.blankLine ?? "any";

    const check = (statements: readonly ESTree.Node[]): void => {
      const listed = statements.filter(isStatement);
      for (const [index, next] of listed.entries()) {
        const previous = listed[index - 1];
        if (previous === undefined) continue;
        const blankLine = blankLineBetween(previous, next);
        if (blankLine === "always") {
          const gap = statementPadding(sourceCode, previous, next);
          if (!gap.padded)
            context.report({
              node: next,
              messageId: "padding",
              fix: (fixer) => fixer.replaceTextRange(gap.range, gap.text),
            });
        } else if (blankLine === "never") {
          const gap = statementUnpadding(sourceCode, previous, next);
          if (gap.padded)
            context.report({
              node: next,
              messageId: "noPadding",
              fix: (fixer) => fixer.replaceTextRange(gap.range, gap.text),
            });
        }
      }
    };

    return {
      Program: (node) => check(node.body),
      BlockStatement: (node) => check(node.body),
      StaticBlock: (node) => check(node.body),
      SwitchStatement: (node) => check(node.cases),
      SwitchCase: (node) => check(node.consequent),
      TSModuleBlock: (node) => check(node.body),
    };
  },
};
