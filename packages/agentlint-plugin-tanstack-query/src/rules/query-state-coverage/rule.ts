import { defineRule } from "@aurelienbbn/agentlint";

const queryCallPattern = /\b(?:useQuery|useInfiniteQuery|queryOptions|infiniteQueryOptions)\s*\(/;

function shouldReviewQueryCall(text: string): boolean {
  return queryCallPattern.test(text);
}

export const queryStateCoverage = defineRule({
  id: "tanstack-query/query-state-coverage",
  description: "Flags TanStack Query usages for pending, error, empty, success, and retry-state review.",
  guidance:
    "Review the flagged TanStack Query usage from the visible UI boundary. User-facing queries should intentionally handle pending, error, empty success, populated success, and retry states. Accept when this call is a shared query definition whose caller clearly owns the visible states, a background prefetch, or dev/test-only support. For true positives, separate loading from error, avoid rendering empty success for failed queries, add a retry affordance when useful, and make empty states distinct from errors.",
  createOnce(context) {
    return {
      call_expression(node) {
        if (!shouldReviewQueryCall(node.text)) return;

        context.report({
          node,
          message: "Review this TanStack Query usage for pending, error, empty, success, and retry-state coverage.",
        });
      },
    };
  },
});
