/**
 * Disallow seeding `useState` from query data that is still undefined on first render.
 *
 * @attribution "Practical React Query" and "React Query and Forms" by Dominik Dorfmeister, tkdodo.eu (concept)
 */
import type { Rule } from "@oxlint/plugins";
import { isReactHook, referencesQueryData } from "../query-data-support.js";

const message =
  "useState reads its argument once, while this query's data is still undefined, and the copy never sees later refetches. Derive the value from data during render, use select, or render a child component that receives data as a prop.";

export const noQueryDataInUseState: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing useQuery/useInfiniteQuery/useQueries data to useState as its initial value; suspense queries and initialData are exempt.",
    },
    messages: { noQueryDataInUseState: message },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const initial = node.arguments[0];
        if (initial === undefined || initial.type === "SpreadElement") return;
        if (!isReactHook(context, node.callee, "useState")) return;
        if (referencesQueryData(context, initial))
          context.report({ node: initial, messageId: "noQueryDataInUseState" });
      },
    };
  },
};
