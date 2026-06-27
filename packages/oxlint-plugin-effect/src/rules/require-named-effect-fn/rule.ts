import type { ESTree, Rule } from "@oxlint/plugins";
import { isMemberExpression } from "../ast.js";

const message = 'Name Effect.fn calls for tracing, for example Effect.fn("service.method")(...).';

function isEffectFnCall(node: ESTree.Node): node is ESTree.CallExpression {
  return node.type === "CallExpression" && isMemberExpression(node.callee, "Effect", "fn");
}

function isNonEmptyStringLiteral(node: ESTree.Node | undefined): boolean {
  return node?.type === "Literal" && typeof node.value === "string" && node.value.length > 0;
}

export const requireNamedEffectFn: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require Effect.fn calls to include a non-empty name." },
    messages: { namedEffectFn: message },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isEffectFnCall(node)) return;
        if (isNonEmptyStringLiteral(node.arguments[0])) return;
        context.report({ node, messageId: "namedEffectFn" });
      },
    };
  },
};
