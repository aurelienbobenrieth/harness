/**
 * Disallow in-place mutation of data owned by the query cache.
 *
 * @attribution TanStack Query "Updates from Mutation Responses" guide, Immutability section (concept)
 */
import type { Context, ESTree, Rule, Variable } from "@oxlint/plugins";
import { type FunctionNode, isFunctionNode, parentOf, unwrapExpressionKeepingChain } from "@aurelienbbn/oxlint-kit/ast";
import { calleeName, findProperty, propertyName } from "../ast.js";
import { fileImportsQuery, importedQueryName } from "../binding-support.js";

const message =
  "This mutates data owned by the query cache in place: observers are not notified and every reader sees the change. Build a new value instead (spread, map/filter, toSorted/toReversed/toSpliced).";

const cacheWriters: ReadonlySet<string> = new Set(["setQueryData", "setQueriesData"]);
const mutatingMethods: ReadonlySet<string> = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);
const queryOptionOwners: ReadonlySet<string> = new Set([
  "useQuery",
  "useInfiniteQuery",
  "useSuspenseQuery",
  "useSuspenseInfiniteQuery",
  "queryOptions",
  "infiniteQueryOptions",
]);

function isObjectAssign(call: ESTree.CallExpression): boolean {
  const callee = call.callee;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Object" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "assign"
  );
}

/** Return the node that mutates the value a reference is rooted at, if this reference does so. */
function mutation(identifier: ESTree.Node): ESTree.Node | undefined {
  let current: ESTree.Node = identifier;
  let method: string | undefined;
  let climbed = false;
  for (;;) {
    const parent = parentOf(current);
    if (parent === undefined) return undefined;
    if (parent.type === "TSNonNullExpression" || parent.type === "ParenthesizedExpression") {
      current = parent;
      continue;
    }
    if (parent.type === "MemberExpression" && parent.object === current) {
      method = !parent.computed && parent.property.type === "Identifier" ? parent.property.name : undefined;
      climbed = true;
      current = parent;
      continue;
    }
    if (parent.type === "CallExpression") {
      if (parent.callee === current && climbed && method !== undefined && mutatingMethods.has(method)) return parent;
      if (parent.arguments[0] === current && isObjectAssign(parent)) return parent;
      return undefined;
    }
    if (!climbed) return undefined;
    if (parent.type === "AssignmentExpression" && parent.left === current) return parent;
    if (parent.type === "UpdateExpression" && parent.argument === current) return parent;
    if (parent.type === "UnaryExpression" && parent.operator === "delete" && parent.argument === current) return parent;
    return undefined;
  }
}

function firstParameterVariable(context: Context, fn: FunctionNode): Variable | undefined {
  const first = fn.params[0];
  if (first === undefined || first.type !== "Identifier") return undefined;
  return context.sourceCode.scopeManager
    .getDeclaredVariables(fn)
    .find((variable) => variable.identifiers.some((identifier) => identifier === first));
}

function reportMutations(context: Context, variable: Variable | undefined): void {
  for (const reference of variable?.references ?? []) {
    const offender = mutation(reference.identifier);
    if (offender !== undefined) context.report({ node: offender, messageId: "noQueryCacheMutation" });
  }
}

function isQuerySelect(context: Context, property: ESTree.Node): boolean {
  const owner = parentOf(property);
  if (owner?.type !== "ObjectExpression") return false;
  if (findProperty(owner, "queryKey") !== undefined || findProperty(owner, "queryFn") !== undefined) return true;
  const call = parentOf(owner);
  if (call?.type !== "CallExpression" || call.arguments[0] !== owner) return false;
  const name = importedQueryName(context, call.callee);
  return name !== undefined && queryOptionOwners.has(name);
}

export const noQueryCacheMutation: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutating cached query data in place inside setQueryData/setQueriesData updaters, select functions, and getQueryData results.",
    },
    messages: { noQueryCacheMutation: message },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const name = calleeName(node);
        if (name === undefined || node.callee.type !== "MemberExpression" || !fileImportsQuery(context)) return;
        if (cacheWriters.has(name)) {
          const updater = node.arguments[1];
          if (updater === undefined || updater.type === "SpreadElement") return;
          const fn = unwrapExpressionKeepingChain(updater);
          if (isFunctionNode(fn)) reportMutations(context, firstParameterVariable(context, fn));
          return;
        }
        if (name !== "getQueryData") return;
        const declarator = parentOf(node);
        if (declarator?.type !== "VariableDeclarator" || declarator.init !== node) return;
        if (declarator.id.type !== "Identifier") return;
        const id = declarator.id;
        const variable = context.sourceCode.scopeManager
          .getDeclaredVariables(declarator)
          .find((candidate) => candidate.identifiers.some((identifier) => identifier === id));
        reportMutations(context, variable);
      },
      Property(node) {
        if (propertyName(node) !== "select" || !fileImportsQuery(context)) return;
        const fn = unwrapExpressionKeepingChain(node.value);
        if (!isFunctionNode(fn) || !isQuerySelect(context, node)) return;
        reportMutations(context, firstParameterVariable(context, fn));
      },
    };
  },
};
