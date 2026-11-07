import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { isInlineFunction, resolveVariable, unwrapExpression } from "../ast-support.js";
import { getFilename, isTestSupportFile, type RuleContextWithFilename } from "../filename-support.js";

const fetchOwnerNames = new Set(["window", "globalThis", "self", "global"]);
const effectPromiseMethods = new Set(["tryPromise", "promise"]);

function isGlobalFetch(context: Context, callee: ESTree.Node): boolean {
  const target = unwrapExpression(callee);
  if (target.type === "Identifier") {
    return target.name === "fetch" && (resolveVariable(context, target)?.defs.length ?? 0) === 0;
  }
  return (
    target.type === "MemberExpression" &&
    !target.computed &&
    target.object.type === "Identifier" &&
    fetchOwnerNames.has(target.object.name) &&
    target.property.type === "Identifier" &&
    target.property.name === "fetch"
  );
}

function isNullish(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  return (
    (value.type === "Identifier" && value.name === "undefined") ||
    (value.type === "Literal" && value.value === null) ||
    (value.type === "UnaryExpression" && value.operator === "void")
  );
}

/** True when the identifier is a function parameter (or a rest/destructured parameter), so the caller supplies it. */
function isParameter(context: Context, node: ESTree.Node): boolean {
  const target = unwrapExpression(node);
  if (target.type !== "Identifier") return false;
  return resolveVariable(context, target)?.defs.some((definition) => definition.type === "Parameter") ?? false;
}

/** False only for spreads of object literals (also behind `?:`, `&&`, `||`, `??`) that visibly hold no `signal` key. */
function spreadMayCarrySignal(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type === "ObjectExpression") {
    return value.properties.some((property) =>
      property.type === "SpreadElement"
        ? spreadMayCarrySignal(property.argument)
        : property.computed ||
          !(
            (property.key.type === "Identifier" && property.key.name !== "signal") ||
            (property.key.type === "Literal" && property.key.value !== "signal")
          ),
    );
  }
  if (value.type === "ConditionalExpression") {
    return spreadMayCarrySignal(value.consequent) || spreadMayCarrySignal(value.alternate);
  }
  if (value.type === "LogicalExpression") {
    return spreadMayCarrySignal(value.right) || (value.operator !== "&&" && spreadMayCarrySignal(value.left));
  }
  return !(value.type === "Literal" || isNullish(value));
}

/**
 * Decides whether a `fetch` init argument carries a signal.
 * An object literal proves it by a last-wins `signal` property with a usable value. A spread after the signal can
 * override it unless the spread is a literal object without one; a spread of anything else is invisible and proves
 * nothing. A parameter forwarded whole
 * (`fetch(url, init)`, `{ ...init }`) is the caller's signal to supply.
 */
function initCarriesSignal(context: Context, init: ESTree.Node | undefined): boolean {
  if (init === undefined) return false;
  const value = unwrapExpression(init);
  if (isNullish(value)) return false;
  if (value.type !== "ObjectExpression") return isParameter(context, value);

  for (const property of value.properties.toReversed()) {
    if (property.type === "SpreadElement") {
      if (isParameter(context, property.argument)) return true;
      if (spreadMayCarrySignal(property.argument)) return false;
      continue;
    }
    const isSignal =
      !property.computed &&
      ((property.key.type === "Identifier" && property.key.name === "signal") ||
        (property.key.type === "Literal" && property.key.value === "signal"));
    if (!isSignal) continue;
    const signal = unwrapExpression(property.value);
    return signal.type !== "Literal" && !isNullish(signal);
  }
  return false;
}

/** A parameter named as a `Request`, `input` being the name `fetch` itself gives it, brings the caller's signal. */
function isRequestParameter(context: Context, node: ESTree.Node | undefined): boolean {
  if (node === undefined) return false;
  const value = unwrapExpression(node);
  return isParameter(context, value) && value.type === "Identifier" && /request|req$|^input$/iu.test(value.name);
}

/** A `new Request(url, { signal })` first argument carries the signal for a `fetch` call without init. */
function requestCarriesSignal(context: Context, request: ESTree.Node | undefined): boolean {
  if (request === undefined) return false;
  const value = unwrapExpression(request);
  if (value.type !== "NewExpression") return isRequestParameter(context, value);
  return (
    value.callee.type === "Identifier" &&
    value.callee.name === "Request" &&
    (initCarriesSignal(context, value.arguments[1]) || isRequestParameter(context, value.arguments[0]))
  );
}

/** `fetch("data:,")` never touches the network, so there is nothing to cancel. */
function isDataUrl(node: ESTree.Node | undefined): boolean {
  return node?.type === "Literal" && typeof node.value === "string" && node.value.startsWith("data:");
}

function isEffectPromiseThunk(node: ESTree.Node): boolean {
  if (!isInlineFunction(node) || node.params.length > 0) return false;
  let call: ESTree.Node | null | undefined = node.parent;
  if (call?.type === "Property" && call.key.type === "Identifier" && call.key.name === "try") {
    call = call.parent?.parent;
  }
  if (call?.type !== "CallExpression") return false;
  const callee = call.callee;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Effect" &&
    callee.property.type === "Identifier" &&
    effectPromiseMethods.has(callee.property.name)
  );
}

/** `effect/require-abort-signal` owns a parameterless `Effect.tryPromise` / `Effect.promise` thunk. */
function insideEffectPromiseThunk(node: ESTree.Node): boolean {
  for (let current = node.parent; current !== null && current !== undefined; current = current.parent) {
    if (isEffectPromiseThunk(current)) return true;
  }
  return false;
}

export const requireFetchAbortSignal: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every global fetch call (fetch, or window/globalThis/self/global.fetch) to pass an AbortSignal, so the request can be cancelled. Test and test-support files and the thunks of Effect.tryPromise / Effect.promise (owned by effect/require-abort-signal) are skipped.",
    },
    messages: {
      requireFetchAbortSignal:
        "Pass `{ signal }` to this fetch so the request can be cancelled when its caller goes away: take an `AbortSignal` from the caller, or use `AbortSignal.timeout(ms)` for a deadline.",
    },
  },
  create(context) {
    const filename = getFilename(context as RuleContextWithFilename);
    if (isTestSupportFile(filename)) return {};
    return {
      CallExpression(node) {
        if (!isGlobalFetch(context as Context, node.callee)) return;
        if (initCarriesSignal(context as Context, node.arguments[1])) return;
        if (node.arguments[1] === undefined && requestCarriesSignal(context as Context, node.arguments[0])) return;
        if (isDataUrl(node.arguments[0])) return;
        if (insideEffectPromiseThunk(node)) return;
        context.report({ node, messageId: "requireFetchAbortSignal" });
      },
    };
  },
};
