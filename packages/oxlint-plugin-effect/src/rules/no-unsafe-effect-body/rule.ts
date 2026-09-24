import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { effectBodyMethod } from "../binding-support.js";

const throwMessage = "Use Effect.fail, Effect.die, or Effect.try instead of throwing inside an Effect body.";

function isFunctionNode(node: ESTree.Node): boolean {
  return (
    node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression"
  );
}

function isInsideEffectBody(node: ESTree.Node, context: Context): boolean {
  let parent: ESTree.Node | null | undefined = node.parent;

  while (parent !== undefined && parent !== null) {
    if (isFunctionNode(parent)) return effectBodyMethod(context, parent) !== undefined;

    parent = parent.parent;
  }

  return false;
}

/**
 * Reports `throw` statements directly inside Effect generator bodies. The try/catch, global timer, and `await`
 * checks this rule once carried now belong to `@effect/tsgo` (`tryCatchInEffectGen`, `globalTimersInEffect`) and
 * to the type checker, which rejects async generators passed to `Effect.gen`.
 */
export const noUnsafeEffectBody: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow throw inside Effect.gen, Effect.fn, and Effect.fnUntraced bodies.",
    },
    messages: {
      noThrow: throwMessage,
    },
  },
  createOnce(context) {
    return {
      ThrowStatement(node) {
        if (!isInsideEffectBody(node, context)) return;

        context.report({
          node,
          messageId: "noThrow",
        });
      },
    };
  },
};
