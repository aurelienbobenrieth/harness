/**
 * Require optimistic cache writes in `onMutate` to cancel in-flight queries and to settle afterwards.
 *
 * @attribution TanStack Query "Optimistic Updates" guide and "Concurrent Optimistic Updates in React Query" by Dominik Dorfmeister, tkdodo.eu (concept)
 */
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { calleeName, findProperty, hasSpread, parentOf, propertyName, resolveFunction, someNode } from "../ast.js";
import { fileImportsQuery, importedQueryName } from "../binding-support.js";

const missingCancel =
  "This onMutate writes optimistic data without cancelling in-flight queries, so a refetch that lands afterwards overwrites it. Await queryClient.cancelQueries(...) for the affected keys before writing.";
const missingSettle =
  "This mutation writes optimistic data in onMutate but never settles it, so a failed request leaves fake data in the cache. Add onError to roll back, or onSettled to invalidate the affected queries.";

const cacheWriters: ReadonlySet<string> = new Set(["setQueryData", "setQueriesData"]);
const mutationOptionOwners: ReadonlySet<string> = new Set(["useMutation", "mutationOptions"]);

function isMutationOptions(context: Context, owner: ESTree.ObjectExpression): boolean {
  if (findProperty(owner, "mutationFn") !== undefined) return true;
  const call = parentOf(owner);
  if (call?.type !== "CallExpression" || call.arguments[0] !== owner) return false;
  const name = importedQueryName(context, call.callee);
  return name !== undefined && mutationOptionOwners.has(name);
}

function callsMatching(root: ESTree.Node, matches: (name: string) => boolean): boolean {
  return someNode(root, (node) => {
    if (node.type !== "CallExpression") return false;
    const name = calleeName(node);
    return name !== undefined && matches(name);
  });
}

export const requireOptimisticUpdateGuards: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require onMutate handlers that write to the query cache to call cancelQueries first and to pair with onError or onSettled.",
    },
    messages: { missingCancel, missingSettle },
    schema: [],
  },
  createOnce(context) {
    return {
      Property(node) {
        if (propertyName(node) !== "onMutate" || !fileImportsQuery(context)) return;
        const owner = parentOf(node);
        if (owner?.type !== "ObjectExpression" || !isMutationOptions(context, owner)) return;
        const handler = resolveFunction(context, node.value);
        if (handler === undefined || handler.body === null) return;
        if (!callsMatching(handler.body, (name) => cacheWriters.has(name))) return;
        if (!callsMatching(handler.body, (name) => name.toLowerCase().includes("cancel")))
          context.report({ node: node.key, messageId: "missingCancel" });
        if (hasSpread(owner)) return;
        if (findProperty(owner, "onError") === undefined && findProperty(owner, "onSettled") === undefined)
          context.report({ node: node.key, messageId: "missingSettle" });
      },
    };
  },
};
