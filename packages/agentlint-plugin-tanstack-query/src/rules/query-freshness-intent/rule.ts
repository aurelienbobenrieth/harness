import { defineRule, type AgentlintNode } from "@aurelienbbn/agentlint";
import { acceptsQueryOptions, calleeName, pairKey } from "../query-calls.js";

const refetchSwitchKeys: ReadonlySet<string> = new Set([
  "refetchOnWindowFocus",
  "refetchOnMount",
  "refetchOnReconnect",
]);
const queryConfigKeys: ReadonlySet<string> = new Set([
  "queryKey",
  "queryFn",
  "staleTime",
  "gcTime",
  "refetchInterval",
  "placeholderData",
  ...refetchSwitchKeys,
]);
const serverRenderedSourcePattern = /^\s*["']use client["']|\bHydrationBoundary\b|\bdehydrate\s*\(|\bhydrate\s*\(/m;
const staleTimePattern = /\bstaleTime\b/;

function pairsOf(object: AgentlintNode): ReadonlyArray<AgentlintNode> {
  return object.children.filter((child) => child.type === "pair");
}

function valueOf(pair: AgentlintNode): AgentlintNode | null {
  return pair.childByFieldName("value");
}

function isZero(node: AgentlintNode | null): boolean {
  return node?.type === "number" && Number(node.text) === 0;
}

function enclosingPairKey(object: AgentlintNode): string | null {
  return object.parent?.type === "pair" ? pairKey(object.parent) : null;
}

function isDefaultQueriesObject(object: AgentlintNode): boolean {
  if (enclosingPairKey(object) !== "queries") return false;
  const outer = object.parent?.parent;
  return outer?.type === "object" && enclosingPairKey(outer) === "defaultOptions";
}

function isQueryConfigObject(object: AgentlintNode, keys: ReadonlyArray<string | null>): boolean {
  if (keys.some((key) => key !== null && queryConfigKeys.has(key))) return true;
  if (isDefaultQueriesObject(object)) return true;
  const argumentList = object.parent;
  const call = argumentList?.type === "arguments" ? argumentList.parent : null;
  return call?.type === "call_expression" && acceptsQueryOptions(calleeName(call));
}

function disabledSwitches(
  object: AgentlintNode,
): ReadonlyArray<{ readonly pair: AgentlintNode; readonly label: string }> {
  const pairs = pairsOf(object);
  const keys = pairs.map(pairKey);
  const staleTime = pairs.find((pair) => pairKey(pair) === "staleTime");
  const hasFreshnessWindow = staleTime !== undefined && !isZero(valueOf(staleTime));
  const inQueryConfig = isQueryConfigObject(object, keys);

  return pairs.flatMap((pair) => {
    const key = pairKey(pair);
    const value = valueOf(pair);
    if (key === null || value === null) return [];
    if (refetchSwitchKeys.has(key))
      return value.type === "false" && !hasFreshnessWindow ? [{ pair, label: `${key}: false` }] : [];
    if (key === "gcTime") return isZero(value) ? [{ pair, label: "gcTime: 0" }] : [];
    if (key === "retry" && inQueryConfig && (value.type === "false" || isZero(value))) {
      return [{ pair, label: `retry: ${value.text}` }];
    }
    return [];
  });
}

/**
 * Opinionated review prompt: teams disable focus refetching or retries on
 * purpose, so the detector only schedules the question and the judge accepts
 * any reason tied to the data.
 */
export const queryFreshnessIntent = defineRule({
  lifecycle: "state",
  standard: {
    id: "tanstack-query/query-freshness-intent",
    revision: 1,
    title: "Query Freshness Intent",
    summary:
      "Flags switched-off refetch triggers, retries, or cache time (`refetchOn*: false`, `retry: false|0`, `gcTime: 0`) and server-rendered QueryClients without a `staleTime`, which need a stated freshness intent.",
    guidance: {
      standard:
        "Freshness is expressed with staleTime: it states how long the data may be shown without asking the server again. Switching off refetchOnWindowFocus, refetchOnMount, refetchOnReconnect, retry, or gcTime to quiet request noise hides stale data and transient failures in production instead of describing the data.",
      checks: [
        "Pass: a reason tied to the data is visible in code or comments (expensive report, immutable resource, user-edited form paired with staleTime: Infinity, retry handled by the transport).",
        "Pass: a staleTime expresses the real freshness window and the remaining switches follow from it.",
        "Fail: blanket switches in global defaultOptions with no rationale, typically added to silence duplicate requests seen in development.",
        "Fail: gcTime: 0 or staleTime: 0 applied broadly; staleTime: 0 is already the default and gcTime: 0 discards the cache between mounts.",
        "Server-rendered apps that hydrate queries set a default staleTime above 0, otherwise every hydrated query refetches immediately on the client.",
        "Test-only clients are out of scope; retry: false belongs there.",
      ],
      refs: [
        {
          type: "url",
          href: "https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults",
        },
        { type: "url", href: "https://tanstack.com/query/latest/docs/framework/react/guides/ssr" },
      ],
    },
  },
  binding: {
    id: "tanstack-query/query-freshness-intent",
    authority: "agent",
    include: ["**/*.{ts,tsx,js,jsx}"],
    exclude: ["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**", "**/test-utils.*", "**/test-utils/**"],
  },
  detector: {
    fixtures: {
      mustReport: [
        {
          label: "blanket global switches",
          file: "src/query-client.ts",
          source:
            "export const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnMount: false, retry: false } } });",
        },
        {
          label: "global retry only",
          file: "src/query-client.ts",
          source: "export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });",
        },
        {
          label: "per-query cache time",
          file: "src/todos.ts",
          source: "export const todos = queryOptions({ queryKey, queryFn, gcTime: 0 });",
        },
        {
          label: "zero staleTime does not express a window",
          file: "src/todos.ts",
          source: "export const todos = queryOptions({ queryKey, queryFn, staleTime: 0, refetchOnMount: false });",
        },
        {
          label: "client boundary without staleTime",
          file: "src/providers.tsx",
          source: '"use client";\nconst [client] = useState(() => new QueryClient());',
        },
      ],
      mustStaySilent: [
        {
          label: "freshness window stated",
          file: "src/report.ts",
          source:
            "export const report = queryOptions({ queryKey, queryFn, staleTime: Infinity, refetchOnWindowFocus: false });",
        },
        {
          label: "refetch always",
          file: "src/todos.ts",
          source: 'export const todos = queryOptions({ queryKey, queryFn, refetchOnMount: "always", retry: 2 });',
        },
        {
          label: "unrelated retry option",
          file: "src/upload.ts",
          source: "await upload(file, { retry: false, timeout: 0 });",
        },
        {
          label: "client boundary with staleTime",
          file: "src/providers.tsx",
          source:
            '"use client";\nconst [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000 } } }));',
        },
        {
          label: "single-page app client",
          file: "src/query-client.ts",
          source: "export const queryClient = new QueryClient();",
        },
      ],
    },
    id: "tanstack-query/query-freshness-intent",
    version: 1,
    scan: "file",
    createOnce(context) {
      return {
        object(node) {
          const switches = disabledSwitches(node);
          const first = switches[0];
          if (!first) return;
          const labels = switches.map((entry) => entry.label);

          context.report({
            node: first.pair,
            message: `Query defaults are switched off (${labels.join(", ")}) without a stated freshness window: express how long this data stays fresh with staleTime, or state the data-specific reason next to the option.`,
            evidence: {
              trigger: "disabled-defaults",
              switches: labels,
              global: isDefaultQueriesObject(node),
            },
          });
        },
        new_expression(node) {
          if (node.childByFieldName("constructor")?.text !== "QueryClient") return;
          if (!serverRenderedSourcePattern.test(context.source)) return;
          if (staleTimePattern.test(context.source)) return;

          context.report({
            node,
            message:
              "QueryClient in a server-rendered app sets no staleTime, so hydrated queries refetch immediately on the client: set defaultOptions.queries.staleTime above 0.",
            evidence: { trigger: "hydration-without-stale-time" },
          });
        },
      };
    },
  },
});
