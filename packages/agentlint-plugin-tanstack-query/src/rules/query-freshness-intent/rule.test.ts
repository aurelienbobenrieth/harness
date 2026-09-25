import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { queryFreshnessIntent } from "./rule.js";

const hydrationMessage =
  "QueryClient in a server-rendered app sets no staleTime, so hydrated queries refetch immediately on the client: set defaultOptions.queries.staleTime above 0.";

function switchedOff(labels: string): string {
  return `Query defaults are switched off (${labels}) without a stated freshness window: express how long this data stays fresh with staleTime, or state the data-specific reason next to the option.`;
}

async function messagesFor(source: string, file = "src/query-client.ts"): Promise<ReadonlyArray<string>> {
  const findings = await testRuleOnSource({
    rule: queryFreshnessIntent,
    source: source,
    file: file,
  });
  return findings.map((finding) => finding.message);
}

it("reports blanket global switches once, naming every switch", async () => {
  const source = `
    export const queryClient = new QueryClient({
      defaultOptions: {
        queries: { refetchOnWindowFocus: false, refetchOnMount: false, refetchOnReconnect: false, retry: false, gcTime: 0 },
      },
    });
  `;

  expect(await messagesFor(source)).toEqual([
    switchedOff(
      "refetchOnWindowFocus: false, refetchOnMount: false, refetchOnReconnect: false, retry: false, gcTime: 0",
    ),
  ]);
});

it.each([
  ["global retry: 0", "new QueryClient({ defaultOptions: { queries: { retry: 0 } } });", "retry: 0"],
  ["per-query retry", "useQuery({ queryKey, queryFn, retry: false });", "retry: false"],
  ["member-call options retry", "trpc.todo.list.useQuery(input, { retry: false });", "retry: false"],
  ["per-query gcTime", "queryOptions({ queryKey, queryFn, gcTime: 0 });", "gcTime: 0"],
  [
    "a zero staleTime next to a switch",
    "queryOptions({ queryKey, queryFn, staleTime: 0, refetchOnMount: false });",
    "refetchOnMount: false",
  ],
  [
    "retry next to a stated window",
    "queryOptions({ queryKey, queryFn, staleTime: Infinity, refetchOnWindowFocus: false, retry: false });",
    "retry: false",
  ],
])("reports %s", async (_label, source, labels) => {
  expect(await messagesFor(source)).toEqual([switchedOff(labels)]);
});

it.each([
  [
    "a stated freshness window",
    "queryOptions({ queryKey, queryFn, staleTime: Infinity, refetchOnWindowFocus: false });",
  ],
  [
    "non-false refetch modes",
    'queryOptions({ queryKey, queryFn, refetchOnMount: "always", refetchOnWindowFocus: true });',
  ],
  ["tuned retry and cache time", "queryOptions({ queryKey, queryFn, retry: 2, gcTime: 10 * 60 * 1000 });"],
  ["an unrelated retry option", "await upload(file, { retry: false, timeout: 0 });"],
  ["mutation defaults", "new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });"],
  ["a queries key outside defaultOptions", "configure({ queries: { retry: false } });"],
  ["a single-page app client", "export const queryClient = new QueryClient();"],
])("stays silent on %s", async (_label, source) => {
  expect(await messagesFor(source)).toEqual([]);
});

it.each([
  ["a client boundary", '"use client";\nconst [client] = useState(() => new QueryClient());', "src/providers.tsx"],
  [
    "a hydrating module",
    "const client = new QueryClient();\nexport const state = dehydrate(client);",
    "src/prefetch.ts",
  ],
])("reports a server-rendered QueryClient without staleTime in %s", async (_label, source, file) => {
  expect(await messagesFor(source, file)).toEqual([hydrationMessage]);
});

it.each([
  [
    "staleTime is set",
    '"use client";\nconst [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }));',
  ],
  ["another class is constructed", '"use client";\nconst cache = new QueryCache();'],
  [
    "the directive only appears inside a string",
    'const hint = "add use client here";\nconst client = new QueryClient();',
  ],
])("stays silent on a server-rendered file when %s", async (_label, source) => {
  expect(await messagesFor(source, "src/providers.tsx")).toEqual([]);
});
