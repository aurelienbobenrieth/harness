/**
 * Schedules visible-state review for every user-facing TanStack Query hook.
 *
 * @attribution TkDodo's blog, "Status Checks in React Query" by Dominik Dorfmeister (concept: data-first status ordering, independently worded)
 */
import { defineRule } from "@aurelienbbn/agentlint";
import { calleeName, stateOwningQueryHooks, suspenseQueryHooks } from "../query-calls.js";

const lazyQueryPattern = /\benabled\b|\bskipToken\b/;

const localStateMessage =
  "TanStack Query usage needs visible-state coverage for pending, error, empty, success, and retry states.";
const lazyStateMessage =
  "Lazy TanStack Query usage needs visible-state coverage: drive spinners from isLoading or fetchStatus, never isPending, render a distinct disabled state, and cover error, empty, success, and retry.";
const suspenseStateMessage =
  "Suspense query needs a Suspense fallback and a resettable error boundary above it, plus empty and populated success states; do not add isPending or isError branches.";

type QueryStateMode = "local" | "lazy" | "suspense";

const messages: Readonly<Record<QueryStateMode, string>> = {
  local: localStateMessage,
  lazy: lazyStateMessage,
  suspense: suspenseStateMessage,
};

function queryStateMode(hook: string, callText: string): QueryStateMode | null {
  if (suspenseQueryHooks.has(hook)) return "suspense";
  if (!stateOwningQueryHooks.has(hook)) return null;
  return lazyQueryPattern.test(callText) ? "lazy" : "local";
}

export const queryStateCoverage = defineRule({
  lifecycle: "state",
  standard: {
    id: "tanstack-query/query-state-coverage",
    revision: 2,
    title: "Query State Coverage",
    summary:
      "Flags TanStack Query hook calls (useQuery, useQueries, useInfiniteQuery and their suspense variants, including generic and member-call spellings) that need visible-state coverage.",
    guidance: {
      standard:
        "User-facing TanStack Query usages must intentionally handle pending, error, empty success, populated success, and retry states at the visible UI boundary. Suspense hooks pass through their boundaries instead: a Suspense fallback and a resettable error boundary must exist above the component.",
      checks: [
        "Shared query definitions are acceptable when a caller clearly owns all visible states.",
        "Background prefetches and dev/test-only helpers stay outside the user-facing UI boundary.",
        "Suspense hooks (useSuspenseQuery, useSuspenseQueries, useSuspenseInfiniteQuery) pass when an ancestor Suspense boundary renders a fallback and an ancestor error boundary renders the failure with a reset/retry path (QueryErrorResetBoundary or useQueryErrorResetBoundary); local isPending/isError branches are dead code there and must not be demanded. Empty and populated success still need distinct UI.",
        "Loading and error states stay distinct, failed queries do not render as empty success, retry is available when useful, and empty states are distinct from errors.",
        "A failed background refetch leaves data and error both set: stale data stays visible (check data first, or handle isRefetchError explicitly) instead of being replaced by a full error screen.",
        "Lazy or disabled queries (enabled, skipToken) are pending without fetching: spinners use isLoading or fetchStatus, never isPending, and the not-yet-enabled state has its own UI.",
        "Paginated or keyed queries that keep previous results through placeholderData mark them visually with isPlaceholderData.",
      ],
      refs: [
        { type: "url", href: "https://tkdodo.eu/blog/status-checks-in-react-query" },
        {
          type: "url",
          href: "https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries",
        },
        {
          type: "url",
          href: "https://tanstack.com/query/latest/docs/framework/react/guides/suspense",
        },
      ],
    },
  },
  binding: {
    id: "tanstack-query/query-state-coverage",
    authority: "agent",
    include: ["**/*.{ts,tsx}"],
    exclude: ["**/*.d.ts"],
  },
  detector: {
    fixtures: {
      mustReport: [
        { label: "bare hook", file: "src/module.ts", source: 'useQuery({queryKey:["items"]})' },
        {
          label: "explicit generics",
          file: "src/module.ts",
          source: 'useQuery<Array<Todo>, Error>({queryKey:["items"]})',
        },
        { label: "parallel queries", file: "src/module.ts", source: "useQueries({queries:[]})" },
        {
          label: "suspense parallel queries",
          file: "src/module.ts",
          source: "useSuspenseQueries({queries:[]})",
        },
        {
          label: "suspense hook",
          file: "src/page.tsx",
          source: "const {data} = useSuspenseQuery(todosOptions);",
        },
        {
          label: "member call",
          file: "src/module.ts",
          source: "trpc.todo.list.useQuery(undefined)",
        },
        {
          label: "optional member call",
          file: "src/module.ts",
          source: 'api?.useQuery("get", "/todos")',
        },
      ],
      mustStaySilent: [
        { label: "prefetch", file: "src/module.ts", source: 'prefetchQuery({queryKey:["items"]})' },
        { label: "client accessor", file: "src/module.ts", source: "useQueryClient()" },
        {
          label: "generic client accessor",
          file: "src/module.ts",
          source: "useQueryClient<Client>()",
        },
        { label: "prefixed wrapper", file: "src/module.ts", source: "myUseQuery({})" },
        { label: "suffixed member", file: "src/module.ts", source: "trpc.todo.useQueryState()" },
        {
          label: "shared options",
          file: "src/module.ts",
          source: "queryOptions({queryKey, queryFn})",
        },
        {
          label: "hook result member",
          file: "src/module.ts",
          source: "useQuery.mockReturnValue({})",
        },
      ],
    },
    id: "tanstack-query/query-state-coverage",
    version: 2,
    scan: "file",
    createOnce(context) {
      return {
        call_expression(node) {
          const hook = calleeName(node);
          if (hook === null) return;
          const mode = queryStateMode(hook, node.text);
          if (mode === null) return;

          context.report({ node, message: messages[mode], evidence: { hook, mode } });
        },
      };
    },
  },
});
