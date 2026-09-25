import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "tanstack-query/require-optimistic-update-guards";
const imports = 'import { mutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";\n';

it("reports an onMutate that only writes optimistic data", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export function useAddTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addTodo,
    onMutate: (todo: Todo) => {
      queryClient.setQueryData(["todos"], (old: Todo[]) => [...old, todo]);
    },
  });
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports a missing cancel even when the mutation settles", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export function useAddTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addTodo,
    onMutate: (todo: Todo) => {
      queryClient.setQueryData(["todos"], (old: Todo[]) => [...old, todo]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports a missing settle handler even when queries are cancelled", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { mutationOptions as defineMutation } from "@tanstack/react-query";
export const addTodoOptions = (queryClient: Client) =>
  defineMutation({
    onMutate: async (todo: Todo) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      queryClient.setQueriesData({ queryKey: ["todos"] }, (old: Todo[]) => [...old, todo]);
    },
  });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts cancel, snapshot, rollback and invalidate", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export function useAddTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addTodo,
    onMutate: async (todo: Todo) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const previous = queryClient.getQueryData(["todos"]);
      queryClient.setQueryData(["todos"], (old: Todo[]) => [...old, todo]);
      return { previous };
    },
    onError: (_error, _todo, context) => queryClient.setQueryData(["todos"], context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts onSettled alone and a cancel helper", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const addTodoOptions = (queryClient: Client) =>
  mutationOptions({
    mutationFn: addTodo,
    onMutate: async (todo: Todo) => {
      await cancelTodoQueries(queryClient);
      queryClient.setQueryData(["todos"], (old: Todo[]) => [...old, todo]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("does not demand a settle handler when options are spread in", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const addTodoOptions = (queryClient: Client) =>
  mutationOptions({
    ...rollbackHandlers(queryClient),
    mutationFn: addTodo,
    onMutate: async (todo: Todo) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      queryClient.setQueryData(["todos"], (old: Todo[]) => [...old, todo]);
    },
  });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores onMutate handlers that do not write to the cache", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const useSave = () => useMutation({ mutationFn: save, onMutate: () => toast.info("Saving") });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores onMutate on unrelated objects", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const form = createForm({ onMutate: () => store.setQueryData(["todos"], []) });\n`,
    ),
  ).resolves.toBeUndefined();
});
