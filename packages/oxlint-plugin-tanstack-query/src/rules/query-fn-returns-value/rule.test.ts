import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "tanstack-query/query-fn-returns-value";
const imports = 'import { queryOptions, useMutation } from "@tanstack/react-query";\n';

it("reports a block-bodied queryFn that never returns", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const todos = queryOptions({
  queryKey: ["todos"],
  queryFn: async () => {
    await api.getTodos();
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports a bare return and return undefined", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const todo = queryOptions({
  queryKey: ["todo"],
  queryFn: async () => {
    if (!enabled()) return;
    return api.getTodo();
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const todo = queryOptions({
  queryKey: ["todo"],
  async queryFn() {
    return undefined;
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports when the only return belongs to a nested callback", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const todos = queryOptions({
  queryKey: ["todos"],
  queryFn: async () => {
    const todos = await api.getTodos();
    todos.map((todo) => {
      return todo.id;
    });
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts returned values, null, and expression bodies", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const a = queryOptions({
  queryKey: ["a"],
  queryFn: async () => {
    const todos = await api.getTodos();
    if (todos.length === 0) return null;
    return todos;
  },
});
export const b = queryOptions({ queryKey: ["b"], queryFn: () => api.getTodos() });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts a placeholder that only throws", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const todo = queryOptions({
  queryKey: ["todo"],
  queryFn: () => {
    throw new Error("Not implemented");
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores mutationFn, which may legitimately resolve to nothing", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const useRemove = () =>
  useMutation({
    mutationFn: async (id: string) => {
      await api.remove(id);
    },
  });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores queryFn properties in files that do not import TanStack Query", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export const config = { queryFn: async () => { await work(); } };\n"),
  ).resolves.toBeUndefined();
});
