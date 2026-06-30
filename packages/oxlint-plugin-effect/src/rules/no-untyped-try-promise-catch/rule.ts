import type { ESTree, Rule } from "@oxlint/plugins";
import { isMemberExpression } from "../ast.js";

const message = "Effect.tryPromise should map promise errors with a catch handler instead of leaking unknown errors.";

function isEffectTryPromiseCall(node: ESTree.Node): node is ESTree.CallExpression {
  return node.type === "CallExpression" && isMemberExpression(node.callee, "Effect", "tryPromise");
}

function hasCatchProperty(node: ESTree.Node | undefined): boolean {
  if (node?.type !== "ObjectExpression") return false;

  return node.properties.some((property) => {
    if (property.type !== "Property") return false;
    if (property.key.type === "Identifier") return property.key.name === "catch";
    if (property.key.type === "Literal") return property.key.value === "catch";
    return false;
  });
}

export const noUntypedTryPromiseCatch: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require Effect.tryPromise to map promise errors with a catch handler.",
    },
    messages: {
      noUntypedTryPromiseCatch: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isEffectTryPromiseCall(node)) return;
        if (hasCatchProperty(node.arguments.at(0))) return;

        context.report({
          node,
          messageId: "noUntypedTryPromiseCatch",
        });
      },
    };
  },
};
