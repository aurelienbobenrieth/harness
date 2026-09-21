import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { imperativeQueryFetching } from "./rule.js";

const disabledQueryMessage =
  "Query is permanently disabled and can only run through refetch(): put its inputs in the queryKey and derive enabled (or skipToken) from them, or model the command as a mutation.";
const effectRefetchMessage =
  "refetch() is called from an effect: put the changing input in the queryKey so the query refetches declaratively, and delete the effect.";

async function messagesFor(source: string, file = "src/search.tsx"): Promise<ReadonlyArray<string>> {
  const findings = await testRuleOnSource(imperativeQueryFetching, source, file);
  return findings.map((finding) => finding.message);
}

it("reports a permanently disabled query that closes over its input", async () => {
  const source = `
    import { useQuery } from "@tanstack/react-query";
    export function Search({ term }: { term: string }) {
      const { data, refetch } = useQuery({ queryKey: ["search"], queryFn: () => search(term), enabled: false });
      return <button onClick={() => refetch()}>{data?.length}</button>;
    }
  `;

  expect(await messagesFor(source)).toEqual([disabledQueryMessage]);
});

it.each([
  ["generic hook", 'useQuery<Todo[]>({ queryKey: ["todos"], "enabled": false });'],
  ["shared options with shorthand keys", "queryOptions({ queryKey, queryFn, enabled: false });"],
  ["parallel query entry", "useQueries({ queries: [{ queryKey: ['a'], queryFn, enabled: false }] });"],
  ["member-call options argument", "trpc.user.byId.useQuery(id, { enabled: false });"],
])("reports enabled: false in %s", async (_label, source) => {
  expect(await messagesFor(source)).toEqual([disabledQueryMessage]);
});

it.each([
  ["a derived condition", 'useQuery({ queryKey: ["user", id], queryFn, enabled: Boolean(id) });'],
  ["a negated input", 'useQuery({ queryKey: ["user", id], queryFn, enabled: !!id });'],
  ["skipToken", 'useQuery({ queryKey: ["user", id], queryFn: id ? () => fetchUser(id) : skipToken });'],
  ["an unrelated feature flag", 'const flag = { name: "beta", enabled: false };'],
  ["an unrelated options bag", "useFeature({ enabled: false });"],
  [
    "a nested object that is not the options",
    'useQuery({ queryKey: ["a"], queryFn, meta: { toast: { enabled: false } } });',
  ],
])("stays silent when enabled is %s", async (_label, source) => {
  expect(await messagesFor(source)).toEqual([]);
});

it("reports refetch called from an effect, including nested callbacks and member calls", async () => {
  const source = `
    import { useQuery } from "@tanstack/react-query";
    export function Search({ term, filter }: Props) {
      const { refetch } = useQuery({ queryKey: ["search"], queryFn: () => search(term) });
      const todos = useQuery(todosOptions);
      useEffect(() => { void refetch(); }, [term, refetch]);
      React.useLayoutEffect(function sync() {
        const id = setTimeout(() => todos.refetch(), 100);
        return () => clearTimeout(id);
      }, [filter]);
      return null;
    }
  `;

  expect(await messagesFor(source)).toEqual([effectRefetchMessage, effectRefetchMessage]);
});

it("reports an aliased refetch called from an effect", async () => {
  const source = `
    const { refetch: refetchTodos } = useQuery(todosOptions);
    useEffect(() => { refetchTodos(); }, [filter]);
  `;

  expect(await messagesFor(source)).toEqual([effectRefetchMessage]);
});

it.each([
  ["an event handler", "const { refetch } = useQuery(todosOptions);\nconst onClick = () => { void refetch(); };"],
  [
    "only listed as a dependency",
    "const { refetch } = useQuery(todosOptions);\nuseEffect(() => { track(term); }, [term, refetch]);",
  ],
  [
    "a later effect argument",
    "const { refetch } = useQuery(todosOptions);\nuseEffect(subscribe, [onChange(() => refetch())]);",
  ],
  [
    "a custom hook that is not an effect",
    "const { refetch } = useQuery(todosOptions);\nuseEffectEvent(() => { void refetch(); });",
  ],
  [
    "name only as a prefix of another command",
    "const { refetch } = useQuery(todosOptions);\nuseEffect(() => { prefetchNext(); refetcher(); }, []);",
  ],
  [
    "another client's effect",
    'import { useQuery } from "@apollo/client";\nconst { refetch } = useQuery(DOC);\nuseEffect(() => { void refetch(); }, [term]);',
  ],
  ["a file without any query hook", "useEffect(() => { void refetch(); }, [term]);"],
])("stays silent when refetch is in %s", async (_label, source) => {
  expect(await messagesFor(source)).toEqual([]);
});
