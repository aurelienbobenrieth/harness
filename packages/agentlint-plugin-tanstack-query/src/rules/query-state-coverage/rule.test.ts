import { createVisitors } from "../test-support.js";
import type { AgentlintNode, RuleContext } from "@aurelienbbn/agentlint";
import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { queryStateCoverage } from "./rule.js";

const localMessage =
  "TanStack Query usage needs visible-state coverage for pending, error, empty, success, and retry states.";
const lazyMessage =
  "Lazy TanStack Query usage needs visible-state coverage: drive spinners from isLoading or fetchStatus, never isPending, render a distinct disabled state, and cover error, empty, success, and retry.";
const suspenseMessage =
  "Suspense query needs a Suspense fallback and a resettable error boundary above it, plus empty and populated success states; do not add isPending or isError branches.";

function messagesFor(text: string): ReadonlyArray<string> {
  const context = createContext();
  createVisitors(queryStateCoverage, context).call_expression?.(createNode(text));
  return context.messages;
}

function createNode(text: string): AgentlintNode {
  return {
    type: "call_expression",
    text,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: text.length },
    isNamed: true,
    children: [],
    parent: null,
    childCount: 0,
    childByFieldName: () => null,
    childrenByType: () => [],
    descendantsOfType: () => [],
  };
}

function createContext(): RuleContext & { readonly messages: string[] } {
  const messages: string[] = [];

  return {
    messages,
    path: "src/page.tsx",
    absolutePath: "src/page.tsx",
    source: "",
    dependencies: {},
    report: (options) => {
      messages.push(options.message);
    },
  };
}

it("reports useQuery calls", () => {
  const context = createContext();
  const visitors = createVisitors(queryStateCoverage, context);

  visitors.call_expression?.(createNode("useQuery(userQueryOptions(userId))"));

  expect(context.messages).toEqual([
    "TanStack Query usage needs visible-state coverage for pending, error, empty, success, and retry states.",
  ]);
});

it("reports useInfiniteQuery calls", () => {
  const context = createContext();
  const visitors = createVisitors(queryStateCoverage, context);

  visitors.call_expression?.(createNode("useInfiniteQuery(feedQueryOptions())"));

  expect(context.messages).toEqual([
    "TanStack Query usage needs visible-state coverage for pending, error, empty, success, and retry states.",
  ]);
});

it("leaves shared queryOptions definitions to the UI consumer", () => {
  const context = createContext();
  const visitors = createVisitors(queryStateCoverage, context);

  visitors.call_expression?.(createNode("queryOptions({ queryKey, queryFn })"));

  expect(context.messages).toEqual([]);
});

it("ignores unrelated hooks", () => {
  const context = createContext();
  const visitors = createVisitors(queryStateCoverage, context);

  visitors.call_expression?.(createNode("useMemo(() => value, [value])"));

  expect(context.messages).toEqual([]);
});

it.each([
  "useQuery<Todo[]>({ queryKey, queryFn })",
  "useQuery<Array<Todo>, Error>({ queryKey, queryFn })",
  "useQueries({ queries })",
  "useInfiniteQuery<Page>({ queryKey, queryFn })",
  "trpc.todo.list.useQuery()",
  "api.useQuery('get', '/todos')",
  "$api?.useQuery('get', '/todos')",
])("reports the formerly missed spelling %s", (text) => {
  expect(messagesFor(text)).toEqual([localMessage]);
});

it.each([
  "useQueryClient()",
  "useQueryClient<Client>()",
  "myUseQuery({ queryKey })",
  "reuseQuery({ queryKey })",
  "useQueryState('page')",
  "trpc.todo.list.useQueryKey()",
  "trpc.useUtils().todo.list.prefetch()",
  "useQuery.mockReturnValue({ data: [] })",
  "render(useQuery)",
  "wrap(useQuery(options))",
])("stays silent on the near miss %s", (text) => {
  expect(messagesFor(text)).toEqual([]);
});

it.each([
  "useSuspenseQuery(todosOptions)",
  "useSuspenseQueries({ queries })",
  "useSuspenseInfiniteQuery<Page>(feedOptions)",
])("asks for boundaries instead of local pending branches on %s", (text) => {
  expect(messagesFor(text)).toEqual([suspenseMessage]);
});

it.each([
  "useQuery({ queryKey: ['user', id], queryFn, enabled: Boolean(id) })",
  "useQuery({ queryKey: ['user', id], queryFn: id ? () => fetchUser(id) : skipToken })",
])("asks lazy queries to spin on isLoading rather than isPending: %s", (text) => {
  expect(messagesFor(text)).toEqual([lazyMessage]);
});

it("reports each hook once through the real parser and records the review mode", async () => {
  const findings = await testRuleOnSource(
    queryStateCoverage,
    [
      "const client = useQueryClient();",
      "const todos = useQuery<Todo[], Error>({ queryKey: ['todos'], queryFn });",
      "const user = trpc.user.byId.useQuery(id, { enabled: id !== undefined });",
      "const feed = useSuspenseInfiniteQuery(feedOptions);",
    ].join("\n"),
    "src/page.tsx",
  );

  expect(findings.map((finding) => finding.message)).toEqual([localMessage, lazyMessage, suspenseMessage]);
});
