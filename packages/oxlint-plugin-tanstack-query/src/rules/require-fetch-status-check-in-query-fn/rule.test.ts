import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "tanstack-query/require-fetch-status-check-in-query-fn";
const imports = 'import { queryOptions, useMutation } from "@tanstack/react-query";\n';

it("reports the fetch-then-json one-liner", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const todos = queryOptions({
  queryKey: ["todos"],
  queryFn: () => fetch("/api/todos").then((response) => response.json()),
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports an awaited fetch whose body is read without a status check", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const todos = queryOptions({
  queryKey: ["todos"],
  queryFn: async ({ signal }) => {
    const response = await window.fetch("/api/todos", { signal });
    return response.json();
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports an unchecked fetch in a mutationFn resolved one hop", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}const saveTodo = async (todo: unknown) => {
  const response = await fetch("/api/todos", { method: "POST", body: JSON.stringify(todo) });
  return response.json();
};
export const useSave = () => useMutation({ mutationFn: saveTodo });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts a response.ok check that throws", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const todos = queryOptions({
  queryKey: ["todos"],
  queryFn: async () => {
    const response = await fetch("/api/todos");
    if (!response.ok) throw new Error("Request failed");
    return response.json();
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts a status check inside the then callback and a destructured status", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const a = queryOptions({
  queryKey: ["a"],
  queryFn: () => fetch("/api/a").then((response) => (response.status === 200 ? response.json() : Promise.reject(response))),
});
export const b = queryOptions({
  queryKey: ["b"],
  queryFn: async () => {
    const { ok, json } = await fetch("/api/b");
    return ok ? json() : Promise.reject(new Error("failed"));
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("stays silent when the response is delegated to a helper", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const a = queryOptions({ queryKey: ["a"], queryFn: async () => parseResponse(await fetch("/api/a")) });
export const b = queryOptions({ queryKey: ["b"], queryFn: () => fetch("/api/b").then(handleResponse) });
export const c = queryOptions({
  queryKey: ["c"],
  queryFn: async () => {
    const response = await fetch("/api/c");
    return decode(response);
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores throwing clients and a locally shadowed fetch", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}import { fetch } from "./http-client";
export const a = queryOptions({ queryKey: ["a"], queryFn: () => fetch("/api/a").then((response) => response.json()) });
export const b = queryOptions({ queryKey: ["b"], queryFn: () => ky.get("/api/b").json() });
export const c = queryOptions({ queryKey: ["c"], queryFn: () => api.fetch("/api/c") });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores fetch outside query functions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const ping = () => fetch("/api/ping").then((response) => response.json());
export const todos = queryOptions({ queryKey: ["todos"], queryFn: () => api.getTodos() });\n`,
    ),
  ).resolves.toBeUndefined();
});
