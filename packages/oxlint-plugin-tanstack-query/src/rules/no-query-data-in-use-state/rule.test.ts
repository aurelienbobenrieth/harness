import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "tanstack-query/no-query-data-in-use-state";
const imports =
  'import { useState } from "react";\nimport { useQuery, useSuspenseQuery } from "@tanstack/react-query";\n';

it("reports destructured query data passed to useState", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export function Todos() {
  const { data } = useQuery(todosOptions);
  const [todos, setTodos] = useState(data);
  return [todos, setTodos];
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports aliased data with a default, derived expressions and lazy initializers", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export function Todos() {
  const { data: todos = [] } = useQuery(todosOptions);
  return useState(() => todos.map((todo) => todo.id));
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports result.data with aliased imports and the React namespace", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import * as React from "react";
import { useQuery as useQ } from "@tanstack/react-query";
export function Todos() {
  const query = useQ(todosOptions);
  return React.useState(query.data?.title ?? "");
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts suspense data, initialData and non-data fields", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export function Form() {
  const { data } = useSuspenseQuery(todoOptions);
  const seeded = useQuery({ queryKey: ["todo"], queryFn: fetchTodo, initialData: emptyTodo });
  const { isPending, data: live } = useQuery(todosOptions);
  const [draft] = useState(data.title);
  const [copy] = useState(seeded.data);
  const [open] = useState(isPending);
  return [draft, copy, open, live];
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts a prop named data and an object key named data", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export function Editor({ data }: { data: Todo }) {
  const { data: remote } = useQuery(todosOptions);
  const [draft] = useState(data);
  const [wrapped] = useState({ data: 1 });
  return [draft, wrapped, remote];
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores a local useQuery that is not imported from TanStack Query", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { useState } from "react";
import { useQuery } from "./graphql-client";
export function Todos() {
  const { data } = useQuery(todosDocument);
  return useState(data);
}\n`,
    ),
  ).resolves.toBeUndefined();
});
