/**
 * Require inline async actor logic that `fetch`es a read to forward the actor's
 * abort signal: `fromPromise` (XState v5), `createAsyncLogic({ run })` and
 * `<setup>.createInvoke({ src })` (XState v6).
 */
import {
  binding,
  isFunctionNode,
  memberPropertyName,
  stringLiteralValue,
  unwrapExpressionKeepingChain,
  walk,
} from "@aurelienbbn/oxlint-kit/ast";
import { findProperty, isSetupResult } from "../ast.js";
import { importedName } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "Async actor logic aborts its signal when the actor stops, but this fetch ignores it and keeps running after the state is left: destructure { signal } and pass it to fetch(url, { signal }).";

const fetchHosts: ReadonlySet<string> = new Set(["globalThis", "window", "self"]);

function isGlobalFetch(context: Context, callee: ESTree.Node): boolean {
  if (callee.type === "Identifier") {
    if (callee.name !== "fetch") return false;
    const variable = binding(context, callee, "fetch");
    return variable === undefined || variable.defs.length === 0;
  }
  return (
    memberPropertyName(callee) === "fetch" &&
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    fetchHosts.has(callee.object.name)
  );
}

/** Reads are worth aborting; a request with an explicit or dynamic non-GET method is left alone. */
function isAbortableRead(call: ESTree.CallExpression): boolean {
  const init = call.arguments[1];
  if (init === undefined) return true;
  const options = unwrapExpressionKeepingChain(init);
  if (options.type !== "ObjectExpression") return false;
  if (options.properties.some((property) => property.type !== "Property")) return false;
  const method = findProperty(options, "method");
  if (method === undefined) return true;
  const verb = stringLiteralValue(unwrapExpressionKeepingChain(method.value))?.toUpperCase();
  return verb === "GET" || verb === "HEAD";
}

function inlineFunction(node: ESTree.Node | undefined): ESTree.Node | undefined {
  if (node === undefined) return undefined;
  const value = unwrapExpressionKeepingChain(node);
  return isFunctionNode(value) ? value : undefined;
}

/**
 * The inline async function of an async-logic call: `fromPromise(fn)` (XState v5),
 * `createAsyncLogic({ run })` and `<setup>.createInvoke({ src })` (XState v6).
 */
function asyncLogicFunction(context: Context, call: ESTree.CallExpression): ESTree.Node | undefined {
  const first = call.arguments[0];
  if (first === undefined || first.type === "SpreadElement") return undefined;
  const imported = importedName(context, call.callee);
  if (imported === "fromPromise") return inlineFunction(first);
  const slot =
    imported === "createAsyncLogic"
      ? "run"
      : call.callee.type === "MemberExpression" &&
          memberPropertyName(call.callee) === "createInvoke" &&
          isSetupResult(context, call.callee.object)
        ? "src"
        : undefined;
  if (slot === undefined) return undefined;
  return inlineFunction(findProperty(unwrapExpressionKeepingChain(first), slot)?.value);
}

export const promiseActorAbortSignal: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require inline async actor logic (fromPromise, createAsyncLogic run, createInvoke src) that calls fetch for a read to forward the actor's abort signal.",
    },
    messages: {
      promiseActorAbortSignal: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const logic = asyncLogicFunction(context, node);
        if (logic === undefined) return;
        const reads: ESTree.CallExpression[] = [];
        let usesSignal = false;
        walk(logic, (child) => {
          if (child.type === "Identifier" && child.name === "signal") usesSignal = true;
          if (child.type === "CallExpression" && isGlobalFetch(context, child.callee) && isAbortableRead(child))
            reads.push(child);
        });
        if (usesSignal) return;
        for (const read of reads) context.report({ node: read, messageId: "promiseActorAbortSignal" });
      },
    };
  },
};
