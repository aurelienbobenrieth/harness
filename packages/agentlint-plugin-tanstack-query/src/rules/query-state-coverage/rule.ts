import { defineRule } from "@aurelienbbn/agentlint";

const queryCallPattern = /\b(?:useQuery|useInfiniteQuery|queryOptions|infiniteQueryOptions)\s*\(/;

function shouldReportQueryCall(text: string): boolean {
  return queryCallPattern.test(text);
}

export const queryStateCoverage = defineRule({
  id: "tanstack-query/query-state-coverage",
  description: "Flags TanStack Query usages that need visible-state coverage.",
  guidance: {
    standard:
      "User-facing TanStack Query usages must intentionally handle pending, error, empty success, populated success, and retry states at the visible UI boundary.",
    checks: [
      "Shared query definitions are acceptable when a caller clearly owns all visible states.",
      "Background prefetches and dev/test-only helpers stay outside the user-facing UI boundary.",
      "Loading and error states stay distinct, failed queries do not render as empty success, retry is available when useful, and empty states are distinct from errors.",
    ],
  },
  createOnce(context) {
    return {
      call_expression(node) {
        if (!shouldReportQueryCall(node.text)) return;

        context.report({
          node,
          message:
            "TanStack Query usage needs visible-state coverage for pending, error, empty, success, and retry states.",
        });
      },
    };
  },
});
