import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "tanstack-query/no-query-cache-mutation";
const imports = 'import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";\n';

it("reports push on the previous value inside a setQueryData updater", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export function useAddTodo() {
  const queryClient = useQueryClient();
  return (todo: Todo) =>
    queryClient.setQueryData(["todos"], (old: Todo[]) => {
      old.push(todo);
      return old;
    });
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it.each([
  "old.meta.count = 1;",
  "old.items[0].done = true;",
  "delete old.draft;",
  "Object.assign(old, patch);",
  "old.count++;",
])("reports `%s` in a setQueriesData updater", async (statement) => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const apply = (queryClient: ReturnType<typeof useQueryClient>, patch: object) =>
  queryClient.setQueriesData({ queryKey: ["todos"] }, (old: any) => {
    ${statement}
    return old;
  });
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports an in-place sort inside select", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const useSorted = () =>
  useQuery({ queryKey: ["todos"], queryFn: fetchTodos, select: (data: Todo[]) => data.sort(byDate) });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports select inside an aliased queryOptions call without sibling keys", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { queryOptions as defineQuery } from "@tanstack/react-query";
export const sorted = defineQuery({ ...base, select: (data: Todo[]) => data.items.reverse() });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports mutation of a getQueryData result", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export function bump(queryClient: ReturnType<typeof useQueryClient>) {
  const todos = queryClient.getQueryData<Todo[]>(["todos"]);
  todos?.push(next);
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts immutable updates and mutation of a copy", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const add = (queryClient: ReturnType<typeof useQueryClient>, todo: Todo) => {
  queryClient.setQueryData(["todos"], (old: Todo[] | undefined) => [...(old ?? []), todo]);
  queryClient.setQueryData(["todos"], (old: Todo[]) => old.slice().sort(byDate));
  queryClient.setQueryData(["todos"], (old: Todo[]) => old.map((entry) => ({ ...entry })).reverse());
  queryClient.setQueryData(["todos"], (old: Todo[]) => {
    const next = [...old];
    next.push(todo);
    return next;
  });
};
export const sorted = queryOptions({ queryKey: ["todos"], queryFn: fetchTodos, select: (data: Todo[]) => data.toSorted(byDate) });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts immer drafts, which are a different binding", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}import { produce } from "immer";
export const add = (queryClient: ReturnType<typeof useQueryClient>, todo: Todo) =>
  queryClient.setQueryData(["todos"], (old: Todo[]) =>
    produce(old, (draft) => {
      draft.push(todo);
    }),
  );\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores unrelated select options and files without TanStack Query", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const dropdown = createDropdown({ select: (items: string[]) => items.sort() });\n`,
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "export const write = (store: Store) => store.setQueryData(['k'], (old: number[]) => { old.push(1); return old; });\n",
    ),
  ).resolves.toBeUndefined();
});
