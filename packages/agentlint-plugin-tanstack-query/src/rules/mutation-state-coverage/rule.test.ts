import { testRuleFixtures, testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { mutationStateCoverage } from "./rule.js";

const message =
  "TanStack Query mutation needs visible-state coverage for pending, error, retry, and success, including duplicate-submission prevention.";

it.each([
  "useMutation({ mutationFn: saveTodo })",
  "useMutation<Todo, Error, Input>({ mutationFn: saveTodo })",
  "trpc.todo.save.useMutation()",
  "api?.orders.create.useMutation({ onSuccess })",
])("reports mutation hooks through the real parser: %s", async (source) => {
  const findings = await testRuleOnSource(mutationStateCoverage, `const mutation = ${source};`, "src/editor.tsx");
  expect(findings.map((finding) => finding.message)).toEqual([message]);
});

it.each([
  "useMutationState({ filters: { status: 'pending' } })",
  "useSaveMutation()",
  "mutation.useMutationState()",
  "useMutations()",
  "render(useMutation)",
])("stays silent on near misses: %s", async (source) => {
  await expect(testRuleOnSource(mutationStateCoverage, `const value = ${source};`, "src/editor.tsx")).resolves.toEqual(
    [],
  );
});

it("passes its activation and near-miss fixtures", async () => {
  await expect(testRuleFixtures(mutationStateCoverage)).resolves.toMatchObject({ failures: [] });
});
