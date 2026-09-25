/**
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { getSourceText, type SourceContext } from "../ast.js";
import { hasEffectImport } from "../effect-modules.js";

const message = "Use Match from effect instead of a chained literal ternary.";
const comparisonOperators = new Set(["==", "===", "!=", "!=="]);

function unwrapParentheses(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (current.type === "ParenthesizedExpression") current = current.expression;
  return current;
}

function getLiteralComparisonSubject(test: ESTree.Node, source: string): string | undefined {
  const comparison = unwrapParentheses(test);
  if (comparison.type !== "BinaryExpression" || !comparisonOperators.has(comparison.operator)) return undefined;

  const left = unwrapParentheses(comparison.left);
  const right = unwrapParentheses(comparison.right);
  const leftIsLiteral = left.type === "Literal";
  const rightIsLiteral = right.type === "Literal";
  if (leftIsLiteral === rightIsLiteral) return undefined;

  const subject = leftIsLiteral ? right : left;
  return source.slice(subject.start, subject.end);
}

function isChainedLiteralTernary(node: ESTree.ConditionalExpression, source: string): boolean {
  const subject = getLiteralComparisonSubject(node.test, source);
  if (subject === undefined) return false;

  const alternate = unwrapParentheses(node.alternate);
  if (alternate.type !== "ConditionalExpression") return false;

  return getLiteralComparisonSubject(alternate.test, source) === subject;
}

function isChainContinuation(node: ESTree.ConditionalExpression, source: string): boolean {
  let current: ESTree.Node = node;
  let parent = node.parent;
  while (parent?.type === "ParenthesizedExpression") {
    current = parent;
    parent = parent.parent;
  }
  if (parent?.type !== "ConditionalExpression" || parent.alternate !== current) return false;

  return isChainedLiteralTernary(parent, source);
}

export const preferMatch: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Prefer Match from effect over chained literal ternaries.",
    },
    messages: {
      preferMatch: message,
    },
  },
  createOnce(context) {
    let fileImportsEffect = false;

    return {
      Program(node: ESTree.Program) {
        fileImportsEffect = hasEffectImport(node);
      },
      ConditionalExpression(node) {
        if (!fileImportsEffect) return;

        const source = getSourceText(context as SourceContext);
        if (source === undefined) return;
        if (!isChainedLiteralTernary(node, source) || isChainContinuation(node, source)) return;

        context.report({ node, messageId: "preferMatch" });
      },
    };
  },
};
