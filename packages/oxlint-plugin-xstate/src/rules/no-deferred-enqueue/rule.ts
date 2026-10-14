/**
 * Forbid using a v6 handler's `enq` after the handler returned: from a timer,
 * promise, event-listener, or enqueued-effect callback, or after an `await`.
 */
import {
  type FunctionNode,
  binding,
  isFunctionNode,
  memberPropertyName,
  parentOf,
  unwrapExpressionKeepingChain,
  walk,
} from "@aurelienbbn/oxlint-kit/ast";
import { enqueueCallTarget, enqueueHandler } from "../v6-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "enq is only valid while its handler runs, but this call runs later ({{deferral}}): it throws in development and does nothing in production. Call enq synchronously in the handler, e.g. enq.raise(event, { delay }) instead of a timer, or move the async work into an invoked or spawned actor.";

const timerFunctions: ReadonlySet<string> = new Set([
  "queueMicrotask",
  "requestAnimationFrame",
  "requestIdleCallback",
  "setImmediate",
  "setInterval",
  "setTimeout",
]);

const promiseCallbacks: ReadonlySet<string> = new Set(["catch", "finally", "then"]);

function isGlobal(context: Context, node: ESTree.Node & { readonly name: string }): boolean {
  const variable = binding(context, node, node.name);
  return variable === undefined || variable.defs.length === 0;
}

/** How a callback passed to `call` is deferred past the handler's return, if it is. */
function deferralOf(context: Context, call: ESTree.CallExpression, handler: FunctionNode): string | undefined {
  const callee = unwrapExpressionKeepingChain(call.callee);
  if (callee.type === "Identifier") {
    if (timerFunctions.has(callee.name) && isGlobal(context, callee)) return `in a ${callee.name} callback`;
    if (enqueueHandler(context, callee) === handler) return "inside an enqueued effect";
    return undefined;
  }
  const method = memberPropertyName(callee);
  if (method === undefined) return undefined;
  if (promiseCallbacks.has(method)) return `in a .${method} callback`;
  if (method === "addEventListener") return "in an event listener";
  if (timerFunctions.has(method) && callee.type === "MemberExpression" && callee.object.type === "Identifier") {
    const host = callee.object;
    if ((host.name === "window" || host.name === "globalThis") && isGlobal(context, host))
      return `in a ${method} callback`;
  }
  return undefined;
}

/** First deferring callback between `node` and its `handler`, walking outwards. */
function deferredCallback(context: Context, node: ESTree.Node, handler: FunctionNode): string | undefined {
  let current = parentOf(node);
  let child: ESTree.Node = node;
  while (current !== undefined && current !== handler) {
    if (isFunctionNode(child) && current.type === "CallExpression" && current.arguments.includes(child as never)) {
      const deferral = deferralOf(context, current, handler);
      if (deferral !== undefined) return deferral;
    }
    child = current;
    current = parentOf(current);
  }
  return undefined;
}

/** True when an `await` in the handler's own body (not a nested function) ends before `node` starts. */
function followsAwait(handler: FunctionNode, node: ESTree.Node): boolean {
  if (handler.async !== true || handler.body === null) return false;
  let found = false;
  walk(handler.body, (child) => {
    if (found || (isFunctionNode(child) && child !== handler)) return false;
    if (child.type === "AwaitExpression" && child.end <= node.start) found = true;
    return undefined;
  });
  return found;
}

function isInsideFunction(node: ESTree.Node, handler: FunctionNode): boolean {
  let current = parentOf(node);
  while (current !== undefined && current !== handler) {
    if (isFunctionNode(current)) return true;
    current = parentOf(current);
  }
  return false;
}

export const noDeferredEnqueue: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid calling a v6 handler's enq from a timer, promise, listener, or enqueued-effect callback, or after an await.",
    },
    messages: {
      noDeferredEnqueue: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const target = enqueueCallTarget(node);
        if (target === undefined) return;
        const handler = enqueueHandler(context, target);
        if (handler === undefined) return;
        const deferral =
          deferredCallback(context, node, handler) ??
          (!isInsideFunction(node, handler) && followsAwait(handler, node) ? "after an await" : undefined);
        if (deferral === undefined) return;
        context.report({ node, messageId: "noDeferredEnqueue", data: { deferral } });
      },
    };
  },
};
