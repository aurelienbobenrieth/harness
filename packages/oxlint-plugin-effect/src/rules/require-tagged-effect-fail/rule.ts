import type { ESTree, Rule } from "@oxlint/plugins";
import { isMemberExpression } from "../ast.js";

const message = "Fail Effects with a typed error value instead of a raw literal or object.";
const disallowedArgumentTypes = new Set(["ArrayExpression", "Literal", "ObjectExpression", "TemplateLiteral"]);

function isEffectFailCall(node: ESTree.Node): node is ESTree.CallExpression {
  return node.type === "CallExpression" && isMemberExpression(node.callee, "Effect", "fail");
}

function hasRawFailureValue(node: ESTree.Node | undefined): boolean {
  return node !== undefined && disallowedArgumentTypes.has(node.type);
}

export const requireTaggedEffectFail: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require typed error values for Effect.fail.",
    },
    messages: {
      typedFailure: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isEffectFailCall(node)) return;
        if (!hasRawFailureValue(node.arguments[0])) return;

        context.report({
          node,
          messageId: "typedFailure",
        });
      },
    };
  },
};
