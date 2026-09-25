import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  "Pass a visible AbortSignal to make fetch cancellable. Configure a deadline separately when the caller requires bounded duration.";

const fetchOwnerNames = new Set(["window", "globalThis", "self"]);

function isFetchCallee(callee: ESTree.Expression | ESTree.Super): boolean {
  if (callee.type === "Identifier") return callee.name === "fetch";
  if (callee.type === "MemberExpression" && !callee.computed) {
    return (
      callee.object.type === "Identifier" &&
      fetchOwnerNames.has(callee.object.name) &&
      callee.property.type === "Identifier" &&
      callee.property.name === "fetch"
    );
  }
  return false;
}

function optionsProveSignal(argument: ESTree.Expression | ESTree.SpreadElement | undefined): boolean {
  if (argument === undefined) return false;
  if (argument.type !== "ObjectExpression") return false;

  for (const property of argument.properties.toReversed()) {
    if (property.type === "SpreadElement") return false;
    const isSignal =
      !property.computed &&
      ((property.key.type === "Identifier" && property.key.name === "signal") ||
        (property.key.type === "Literal" && property.key.value === "signal"));
    if (!isSignal) continue;
    const value = property.value;
    return (
      value.type !== "Literal" &&
      !(value.type === "Identifier" && value.name === "undefined") &&
      value.type !== "UnaryExpression"
    );
  }
  return false;
}

export const requireFetchAbortSignal: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require fetch calls (direct or window/globalThis/self qualified) to pass an AbortSignal.",
    },
    messages: {
      requireFetchAbortSignal: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isFetchCallee(node.callee)) return;
        if (optionsProveSignal(node.arguments[1])) return;
        const request = node.arguments[0];
        if (
          node.arguments[1] === undefined &&
          request?.type === "NewExpression" &&
          request.callee.type === "Identifier" &&
          request.callee.name === "Request" &&
          optionsProveSignal(request.arguments[1])
        )
          return;
        context.report({ node, messageId: "requireFetchAbortSignal" });
      },
    };
  },
};
