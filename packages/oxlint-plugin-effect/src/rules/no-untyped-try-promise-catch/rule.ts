import type { ESTree, Rule } from "@oxlint/plugins";
import { effectMethod } from "../binding-support.js";

const message =
  "Map thrown and rejected failures to the project domain error contract with an explicit catch handler; the framework default is a generic Cause.UnknownError wrapper.";
const tryConstructors = new Set(["try", "tryPromise"]);

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
      description: "Require Effect.try and Effect.tryPromise to map thrown or rejected values with a catch handler.",
    },
    messages: {
      noUntypedTryPromiseCatch: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!tryConstructors.has(effectMethod(context, node.callee) ?? "")) return;
        if (hasCatchProperty(node.arguments.at(0))) return;

        context.report({
          node,
          messageId: "noUntypedTryPromiseCatch",
        });
      },
    };
  },
};
