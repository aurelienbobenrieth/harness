import type { ESTree, Rule } from "@oxlint/plugins";
import { isMemberExpression } from "../ast.js";

type ParentNode = ESTree.Node & {
  readonly parent?: ParentNode;
};

type FunctionNode = ParentNode & {
  readonly type: "ArrowFunctionExpression" | "FunctionDeclaration" | "FunctionExpression";
};

const throwMessage = "Use Effect.fail, Effect.die, or Effect.try instead of throwing inside an Effect body.";
const awaitMessage =
  "Use Effect.promise, Effect.tryPromise, or yield an Effect instead of awaiting inside an Effect body.";

function isFunctionNode(node: ParentNode): node is FunctionNode {
  return (
    node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression"
  );
}

function isEffectBodyFunction(node: FunctionNode): boolean {
  const parent = node.parent;
  if (parent?.type !== "CallExpression") return false;
  if (!parent.arguments.includes(node)) return false;

  return isMemberExpression(parent.callee, "Effect", "gen") || isMemberExpression(parent.callee, "Effect", "fn");
}

function isInsideEffectBody(node: ESTree.Node): boolean {
  let parent = (node as ParentNode).parent;

  while (parent !== undefined) {
    if (isFunctionNode(parent)) {
      return isEffectBodyFunction(parent);
    }

    parent = parent.parent;
  }

  return false;
}

export const noUnsafeEffectBody: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow throw and await inside Effect.gen and Effect.fn bodies.",
    },
    messages: {
      noAwait: awaitMessage,
      noThrow: throwMessage,
    },
  },
  createOnce(context) {
    return {
      AwaitExpression(node) {
        if (!isInsideEffectBody(node)) return;

        context.report({
          node,
          messageId: "noAwait",
        });
      },
      ThrowStatement(node) {
        if (!isInsideEffectBody(node)) return;

        context.report({
          node,
          messageId: "noThrow",
        });
      },
    };
  },
};
