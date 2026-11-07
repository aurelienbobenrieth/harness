import type { Context, ESTree, Rule } from "@oxlint/plugins";
import {
  type FunctionNode,
  isFunctionNode,
  optionsObject,
  parentOf,
  unwrapExpressionKeepingChain,
  walk,
} from "@aurelienbbn/oxlint-kit/ast";
import { effectMethod, moduleMethod } from "../binding-support.js";
import { getFilename, isAllowedFile, type RuleContextWithOptions } from "../runtime-support.js";
import { isUnshadowedGlobal, stringArrayOption } from "../sota-support.js";
import { testSupportFiles } from "../test-paths.js";

const message =
  "Use Effect.tryPromise with a typed catch mapper: Effect.promise turns every rejection into a defect that catchTag, retry, and error metrics never see.";

const bodyReaders: ReadonlySet<string> = new Set(["arrayBuffer", "blob", "formData", "json", "text"]);

function thunkResult(fn: FunctionNode): ESTree.Node | undefined {
  const body = fn.body;
  if (body === null) return undefined;
  if (body.type !== "BlockStatement") return unwrapExpressionKeepingChain(body);
  const [only, ...rest] = body.body;
  if (only?.type !== "ReturnStatement" || rest.length > 0 || only.argument === null) return undefined;
  return unwrapExpressionKeepingChain(only.argument);
}

function isGlobalMemberCall(context: Context, node: ESTree.CallExpression, objectName: string): boolean {
  return (
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    isUnshadowedGlobal(context, node.callee.object, objectName)
  );
}

/** A thunk is total when it only resolves: `Promise.resolve(x)`, `scheduler.*`, or a resolve-only `new Promise`. */
function isTotalThunk(context: Context, fn: FunctionNode): boolean {
  const result = thunkResult(fn);
  if (result === undefined) return false;
  if (result.type === "CallExpression") {
    if (isGlobalMemberCall(context, result, "scheduler")) return true;
    return (
      isGlobalMemberCall(context, result, "Promise") &&
      result.callee.type === "MemberExpression" &&
      result.callee.property.type === "Identifier" &&
      result.callee.property.name === "resolve"
    );
  }
  if (result.type !== "NewExpression" || !isUnshadowedGlobal(context, result.callee, "Promise")) return false;
  const executor = result.arguments[0];
  return isFunctionNode(executor) && executor.params.length <= 1 && !containsRejectableCall(context, executor);
}

function containsRejectableCall(context: Context, fn: FunctionNode): boolean {
  let found = false;
  walk(fn, (node) => {
    if (found) return false;
    if (node.type === "ImportExpression") found = true;
    if (node.type !== "CallExpression") return undefined;
    if (isUnshadowedGlobal(context, node.callee, "fetch")) found = true;
    const callee = node.callee;
    if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier")
      return undefined;
    if (bodyReaders.has(callee.property.name)) found = true;
    if (
      callee.object.type === "Identifier" &&
      !isUnshadowedGlobal(context, callee.object, "Promise") &&
      !isUnshadowedGlobal(context, callee.object, "scheduler")
    )
      found = true;
    return undefined;
  });
  return found;
}

/** First argument index from which a call's arguments run as cleanup, where the error channel must stay empty. */
const finalizerArguments: ReadonlyMap<string, number> = new Map([
  ["acquireRelease", 1],
  ["acquireUseRelease", 2],
  ["addFinalizer", 0],
  ["ensuring", 0],
  ["onExit", 0],
  ["onInterrupt", 0],
]);

/**
 * A finalizer cannot fail: its error type is `never`, so `Effect.promise` (a rejection is a defect) is the idiom there
 * and `Effect.tryPromise` would force a handler that has nowhere to go.
 */
function isInsideFinalizer(context: Context, node: ESTree.Node): boolean {
  let child: ESTree.Node = node;
  let current: ESTree.Node | undefined = parentOf(node);
  while (current !== undefined) {
    if (current.type === "CallExpression") {
      const index = current.arguments.findIndex((argument) => argument === child);
      if (index !== -1) {
        const method = effectMethod(context, current.callee) ?? moduleMethod(context, current.callee, "Scope");
        const first = method === undefined ? undefined : finalizerArguments.get(method);
        if (first !== undefined && index >= first) return true;
      }
    }
    child = current;
    current = parentOf(current);
  }
  return false;
}

/** Disallow `Effect.promise` for promises that can reject. */
export const noEffectPromise: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Effect.promise outside configured files unless the thunk is a syntactically total promise such as Promise.resolve or a resolve-only timer.",
    },
    messages: { noEffectPromise: message },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
          mode: { enum: ["all", "rejectable-only"] },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [...testSupportFiles], mode: "all" }],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (effectMethod(context, node.callee) !== "promise") return;

        const options = optionsObject(context);
        const allow = stringArrayOption(options, "allow", testSupportFiles);
        if (isAllowedFile(getFilename(context as RuleContextWithOptions), allow)) return;

        if (isInsideFinalizer(context, node)) return;

        const thunk = node.arguments[0];
        if (isFunctionNode(thunk)) {
          if (isTotalThunk(context, thunk)) return;
          if (options["mode"] === "rejectable-only" && !containsRejectableCall(context, thunk)) return;
        } else if (options["mode"] === "rejectable-only") {
          return;
        }

        context.report({ node, messageId: "noEffectPromise" });
      },
    };
  },
};
