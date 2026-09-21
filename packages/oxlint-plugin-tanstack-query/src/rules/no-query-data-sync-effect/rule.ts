/**
 * Disallow effects that copy query data into local state.
 *
 * @attribution "Breaking React Query's API on purpose" and "React Query and Forms" by Dominik Dorfmeister, tkdodo.eu (concept)
 */
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { isFunctionNode, unwrapExpression, walk } from "../ast.js";
import { binding } from "../binding-support.js";
import { isReactHook, referencesQueryData } from "../query-data-support.js";

const message =
  "This effect copies query data into local state, which renders once with the stale value and drifts from the cache on refetch. Derive the value from data during render, or pass data as a prop to a child that owns the draft state.";

const effectHooks = ["useEffect", "useLayoutEffect"] as const;

function isStateSetter(context: Context, callee: ESTree.Node): boolean {
  if (callee.type !== "Identifier") return false;
  return (binding(context, callee, callee.name)?.defs ?? []).some((definition) => {
    const declarator = definition.node;
    if (declarator.type !== "VariableDeclarator" || declarator.init === null) return false;
    if (declarator.id.type !== "ArrayPattern" || declarator.id.elements[1] !== definition.name) return false;
    const call = unwrapExpression(declarator.init);
    return call.type === "CallExpression" && isReactHook(context, call.callee, "useState");
  });
}

export const noQueryDataSyncEffect: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow useEffect/useLayoutEffect callbacks that pass useQuery/useInfiniteQuery/useQueries data to a useState setter.",
    },
    messages: { noQueryDataSyncEffect: message },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callback = node.arguments[0];
        if (callback === undefined || callback.type === "SpreadElement") return;
        const effect = unwrapExpression(callback);
        if (!isFunctionNode(effect) || effect.body === null) return;
        if (!effectHooks.some((hook) => isReactHook(context, node.callee, hook))) return;
        walk(effect.body, (candidate) => {
          if (
            candidate.type === "CallExpression" &&
            isStateSetter(context, candidate.callee) &&
            candidate.arguments.some((argument) => referencesQueryData(context, argument))
          )
            context.report({ node: candidate, messageId: "noQueryDataSyncEffect" });
          return true;
        });
      },
    };
  },
};
