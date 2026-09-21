/**
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import type { ESTree, Rule } from "@oxlint/plugins";
import { isIdentifier } from "../ast.js";
import { isLayerProvisionCall } from "../effect-modules.js";

const message =
  "Combine independent dependencies in one Layer.provide([...]) call; when a layer depends on another, extract and name the configured layer.";

function isPipeMethodCall(node: ESTree.Node): node is ESTree.CallExpression {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    isIdentifier(node.callee.property, "pipe")
  );
}

function isPipeFunctionCall(node: ESTree.CallExpression): boolean {
  return isIdentifier(node.callee, "pipe");
}

function isInnerPipeChainCall(node: ESTree.CallExpression): boolean {
  const parent = node.parent;

  return (
    parent?.type === "MemberExpression" &&
    parent.object === node &&
    isIdentifier(parent.property, "pipe") &&
    parent.parent?.type === "CallExpression" &&
    parent.parent.callee === parent
  );
}

function collectPipeArguments(node: ESTree.CallExpression): readonly ESTree.Node[] {
  if (isPipeFunctionCall(node)) return node.arguments;

  const chain: ESTree.CallExpression[] = [];
  let current: ESTree.Node = node;
  while (isPipeMethodCall(current)) {
    chain.unshift(current);
    if (current.callee.type !== "MemberExpression") break;
    current = current.callee.object;
  }

  return chain.flatMap((call) => call.arguments);
}

export const noCascadingLayerProvide: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow cascading Layer.provide steps within a single pipe.",
    },
    messages: {
      cascadingLayerProvide: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isPipeFunctionCall(node) && !isPipeMethodCall(node)) return;
        if (isPipeMethodCall(node) && isInnerPipeChainCall(node)) return;

        const provisionSteps = collectPipeArguments(node).filter((argument) => isLayerProvisionCall(argument));
        provisionSteps.slice(1).forEach((step) => {
          context.report({ node: step, messageId: "cascadingLayerProvide" });
        });
      },
    };
  },
};
