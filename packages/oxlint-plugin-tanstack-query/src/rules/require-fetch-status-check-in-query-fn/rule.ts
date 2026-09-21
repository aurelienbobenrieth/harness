/**
 * Require a response status check around global `fetch` inside query and mutation functions.
 *
 * @attribution TanStack Query "Query Functions" guide and "React Query Error Handling" by Dominik Dorfmeister, tkdodo.eu (concept)
 */
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { type FunctionNode, isFunctionNode, parentOf, propertyName, unwrapExpression, walk } from "../ast.js";
import { binding, isUnshadowedGlobal } from "../binding-support.js";
import { queryAndMutationFunctionNames, queryFunction } from "../query-function.js";

const message =
  "fetch() resolves on 4xx and 5xx responses, so this query treats a server error as data. Check response.ok (or response.status) and throw before reading the body.";

const globalObjects: ReadonlySet<string> = new Set(["window", "globalThis", "self"]);
const statusProperties: ReadonlySet<string> = new Set(["ok", "status"]);
const bodyReaders: ReadonlySet<string> = new Set(["json", "text", "blob", "arrayBuffer", "formData"]);

function isGlobalFetch(context: Context, call: ESTree.CallExpression): boolean {
  const callee = unwrapExpression(call.callee);
  if (callee.type === "Identifier") return callee.name === "fetch" && isUnshadowedGlobal(context, callee);
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    callee.property.name === "fetch" &&
    callee.object.type === "Identifier" &&
    globalObjects.has(callee.object.name) &&
    isUnshadowedGlobal(context, callee.object)
  );
}

function checksStatus(fn: FunctionNode): boolean {
  let found = false;
  walk(fn, (node) => {
    if (found) return false;
    if (node.type === "ThrowStatement") found = true;
    if (
      node.type === "MemberExpression" &&
      !node.computed &&
      node.property.type === "Identifier" &&
      statusProperties.has(node.property.name)
    )
      found = true;
    if (node.type === "ObjectPattern")
      found ||= node.properties.some((property) => statusProperties.has(propertyName(property) ?? ""));
    return !found;
  });
  return found;
}

/** Climb from the fetch call through `await` and wrappers to the expression whose value is the Response. */
function responseExpression(call: ESTree.CallExpression): ESTree.Node {
  let current: ESTree.Node = call;
  for (;;) {
    const parent = parentOf(current);
    if (
      parent !== undefined &&
      (parent.type === "AwaitExpression" ||
        parent.type === "ParenthesizedExpression" ||
        parent.type === "TSAsExpression" ||
        parent.type === "TSNonNullExpression")
    ) {
      current = parent;
      continue;
    }
    return current;
  }
}

function isArgumentOfCall(node: ESTree.Node): boolean {
  const parent = parentOf(node);
  return (
    (parent?.type === "CallExpression" || parent?.type === "NewExpression") &&
    parent.arguments.includes(node as ESTree.Expression)
  );
}

function readerName(call: ESTree.Node): string | undefined {
  if (call.type !== "CallExpression") return undefined;
  const callee = call.callee;
  return callee.type === "MemberExpression" && callee.property.type === "Identifier" ? callee.property.name : undefined;
}

/** True when the Response is handed to other code that may validate it, which this rule cannot see into. */
function delegatesResponse(context: Context, call: ESTree.CallExpression): boolean {
  const response = responseExpression(call);
  if (isArgumentOfCall(response)) return true;
  const parent = parentOf(response);
  if (
    parent?.type === "MemberExpression" &&
    parent.object === response &&
    parent.property.type === "Identifier" &&
    parent.property.name === "then"
  ) {
    const chained = parentOf(parent);
    if (
      chained?.type === "CallExpression" &&
      chained.callee === parent &&
      chained.arguments.some((argument) => !isFunctionNode(unwrapExpression(argument)))
    )
      return true;
  }
  if (parent?.type !== "VariableDeclarator" || parent.init !== response || parent.id.type !== "Identifier")
    return false;
  const variable = binding(context, parent.id, parent.id.name);
  return (variable?.references ?? []).some((reference) => {
    if (!isArgumentOfCall(reference.identifier)) return false;
    const owner = parentOf(reference.identifier);
    return owner === undefined || !bodyReaders.has(readerName(owner) ?? "");
  });
}

export const requireFetchStatusCheckInQueryFn: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require queryFn/mutationFn bodies that call global fetch to check response.ok or response.status and throw on failure.",
    },
    messages: { requireFetchStatusCheck: message },
    schema: [],
  },
  createOnce(context) {
    return {
      Property(node) {
        const fn = queryFunction(context, node, queryAndMutationFunctionNames);
        if (fn === undefined || fn.body === null || checksStatus(fn)) return;
        walk(fn.body, (candidate) => {
          if (candidate.type === "CallExpression" && isGlobalFetch(context, candidate)) {
            if (!delegatesResponse(context, candidate))
              context.report({ node: candidate, messageId: "requireFetchStatusCheck" });
          }
          return true;
        });
      },
    };
  },
};
