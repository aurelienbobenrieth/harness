/**
 * Require `fromPromise` actors that `fetch` a read to forward the actor's abort signal.
 */
import {
  binding,
  isFunctionNode,
  memberPropertyName,
  stringLiteralValue,
  unwrapExpressionKeepingChain,
  walk,
} from "@aurelienbbn/oxlint-kit/ast";
import { findProperty } from "../ast.js";
import { importedName } from "../binding-support.js";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "fromPromise aborts its signal when the actor stops, but this fetch ignores it and keeps running after the state is left: destructure { signal } and pass it to fetch(url, { signal }).";

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

export const promiseActorAbortSignal: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require inline fromPromise actors that call fetch for a read to forward the actor's abort signal.",
    },
    messages: {
      promiseActorAbortSignal: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (importedName(context, node.callee) !== "fromPromise") return;
        const first = node.arguments[0];
        if (first === undefined) return;
        const logic = unwrapExpressionKeepingChain(first);
        if (!isFunctionNode(logic)) return;
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
