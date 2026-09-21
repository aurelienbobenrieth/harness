import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "tanstack-query/no-query-data-sync-effect";
const imports = 'import { useEffect, useState } from "react";\nimport { useQuery } from "@tanstack/react-query";\n';

it("reports an effect that copies query data into state", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export function Todos() {
  const { data } = useQuery(todosOptions);
  const [todos, setTodos] = useState<Todo[]>([]);
  useEffect(() => {
    if (data) setTodos(data);
  }, [data]);
  return todos;
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports result.data synced in useLayoutEffect through aliased imports", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { useLayoutEffect as useLayout, useState } from "react";
import { useQuery as useQ } from "@tanstack/react-query";
export function Title() {
  const query = useQ(todoOptions);
  const [title, setTitle] = useState("");
  useLayout(() => {
    setTitle(query.data?.title ?? "");
  }, [query.data]);
  return title;
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts effects that set state from something other than query data", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export function Todos({ filter }: { filter: string }) {
  const { data, isSuccess } = useQuery(todosOptions);
  const [seen, setSeen] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => {
    if (isSuccess) setSeen(true);
    setText(filter);
  }, [isSuccess, filter]);
  return [data, seen, text];
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts query data passed to a function that is not a state setter", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export function Todos({ onLoaded }: { onLoaded: (todos: Todo[]) => void }) {
  const { data } = useQuery(todosOptions);
  useEffect(() => {
    if (data) onLoaded(data);
  }, [data, onLoaded]);
  return data;
}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores a useQuery that is not imported from TanStack Query", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { useEffect, useState } from "react";
import { useQuery } from "./graphql-client";
export function Todos() {
  const { data } = useQuery(todosDocument);
  const [todos, setTodos] = useState([]);
  useEffect(() => {
    setTodos(data);
  }, [data]);
  return todos;
}\n`,
    ),
  ).resolves.toBeUndefined();
});
