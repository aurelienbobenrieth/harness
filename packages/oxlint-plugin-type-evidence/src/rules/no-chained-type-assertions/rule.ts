/**
 * @attribution anti-slop by Dillon Mulroy (MIT, concept re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { isAssertionExpression, isConstAssertion, unwrapExpressionParens, type ParentedNode } from "../ast.js";

const message =
  "This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.";

function isOutermostAssertion(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): boolean {
  let parent = (node as ParentedNode).parent ?? undefined;
  while (parent !== undefined && parent !== null && parent.type === "ParenthesizedExpression") {
    parent = (parent as ParentedNode).parent ?? undefined;
  }
  return parent === undefined || parent === null || !isAssertionExpression(parent);
}

function shouldReport(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): boolean {
  if (!isOutermostAssertion(node)) return false;

  let assertionCount = 0;
  let hasNonConstAssertion = false;
  let current: ESTree.Node = node;
  while (isAssertionExpression(current)) {
    assertionCount += 1;
    if (!isConstAssertion(current)) hasNonConstAssertion = true;
    current = unwrapExpressionParens(current.expression);
  }
  return assertionCount >= 2 && hasNonConstAssertion;
}

export const noChainedTypeAssertions: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow chains of type assertions that launder a value through unknown or any.",
    },
    messages: {
      chainedAssertion: message,
    },
  },
  createOnce(context) {
    return {
      TSAsExpression(node) {
        if (!shouldReport(node)) return;
        context.report({ node, messageId: "chainedAssertion" });
      },
      TSTypeAssertion(node) {
        if (!shouldReport(node)) return;
        context.report({ node, messageId: "chainedAssertion" });
      },
    };
  },
};
