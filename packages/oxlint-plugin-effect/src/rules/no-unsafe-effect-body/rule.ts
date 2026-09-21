import type { ESTree, Rule, Context } from "@oxlint/plugins";
import { binding, effectBodyMethod } from "../binding-support.js";

type FunctionNode = ESTree.Node & {
  readonly type: "ArrowFunctionExpression" | "FunctionDeclaration" | "FunctionExpression";
};

const throwMessage = "Use Effect.fail, Effect.die, or Effect.try instead of throwing inside an Effect body.";
const awaitMessage =
  "Use Effect.promise, Effect.tryPromise, or yield an Effect instead of awaiting inside an Effect body.";
const tryCatchMessage =
  "Effect failures are never thrown into the generator, so this catch block is dead code for the yielded Effects. Handle them with Effect.catch, Effect.catchTag, or Effect.result.";
const tryFinallyMessage =
  "A failed or interrupted yield* abandons the generator, so this finally block does not run. Use Effect.ensuring, Effect.onExit, or Effect.acquireRelease.";
const timerMessage =
  "Global timers escape interruption and TestClock inside an Effect body. Use Effect.sleep, Effect.delay, or Effect.repeat with a Schedule; wrap callback sources in Effect.callback.";

const timerNames = new Set(["setTimeout", "setInterval", "setImmediate"]);

function isFunctionNode(node: ESTree.Node): node is FunctionNode {
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

function isWithin(node: ESTree.Node, container: ESTree.Node): boolean {
  let current: ESTree.Node | null | undefined = node;

  while (current !== undefined && current !== null) {
    if (current === container) return true;
    if (isFunctionNode(current)) return false;
    current = current.parent;
  }

  return false;
}

function isGlobalTimerCallee(callee: ESTree.Node, context: Context): boolean {
  if (callee.type === "Identifier") {
    return timerNames.has(callee.name) && (binding(context, callee, callee.name)?.defs.length ?? 0) === 0;
  }

  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    (callee.object.name === "globalThis" || callee.object.name === "window") &&
    (binding(context, callee.object, callee.object.name)?.defs.length ?? 0) === 0 &&
    callee.property.type === "Identifier" &&
    timerNames.has(callee.property.name)
  );
}

/**
 * @attribution @effect/language-service diagnostics tryCatchInEffectGen and globalTimersInEffect (concept)
 */
export const noUnsafeEffectBody: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow throw, await, try blocks around yield*, and global timers inside Effect.gen, Effect.fn, and Effect.fnUntraced bodies.",
    },
    messages: {
      noAwait: awaitMessage,
      noThrow: throwMessage,
      noTimer: timerMessage,
      noTryCatch: tryCatchMessage,
      noTryFinally: tryFinallyMessage,
    },
  },
  createOnce(context) {
    let tryStatements: ESTree.TryStatement[] = [];
    const reported = new Set<ESTree.Node>();

    return {
      Program() {
        tryStatements = [];
        reported.clear();
      },
      AwaitExpression(node) {
        if (!isInsideEffectBody(node, context)) return;

        context.report({
          node,
          messageId: "noAwait",
        });
      },
      ThrowStatement(node) {
        if (!isInsideEffectBody(node, context)) return;

        context.report({
          node,
          messageId: "noThrow",
        });
      },
      TryStatement(node) {
        if (isInsideEffectBody(node, context)) tryStatements.push(node);
      },
      "TryStatement:exit"(node: ESTree.TryStatement) {
        if (tryStatements.at(-1) === node) tryStatements.pop();
      },
      YieldExpression(node) {
        if (!node.delegate) return;

        for (const statement of tryStatements) {
          if (reported.has(statement) || !isWithin(node, statement.block)) continue;

          reported.add(statement);
          context.report({
            node: statement.handler ?? statement.finalizer ?? statement,
            messageId: statement.handler === null ? "noTryFinally" : "noTryCatch",
          });
        }
      },
      CallExpression(node) {
        if (!isGlobalTimerCallee(node.callee, context)) return;
        if (!isInsideEffectBody(node, context)) return;

        context.report({
          node,
          messageId: "noTimer",
        });
      },
    };
  },
};
