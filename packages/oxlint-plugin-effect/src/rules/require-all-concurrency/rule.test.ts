import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/require-all-concurrency";

it("reports Effect.all without options", async () => {
  await expect(assertRuleReports(ruleName, "const values = Effect.all(programs);\n")).resolves.toBeUndefined();
});

it("reports Effect.all options without concurrency", async () => {
  await expect(
    assertRuleReports(ruleName, "const values = Effect.all(programs, { discard: true });\n"),
  ).resolves.toBeUndefined();
});

it("reports Effect.all tuple calls without concurrency", async () => {
  await expect(assertRuleReports(ruleName, "const values = Effect.all([first, second]);\n")).resolves.toBeUndefined();
});

it("allows Effect.all with numeric concurrency", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const values = Effect.all(programs, { concurrency: 1 });\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.all with named concurrency", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const values = Effect.all(programs, { concurrency: BatchConcurrency.items });\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows quoted concurrency option keys", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const values = Effect.all(programs, { "concurrency": 1 });\n'),
  ).resolves.toBeUndefined();
});

it("ignores non-Effect all calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const values = Promise.all(programs);\n")).resolves.toBeUndefined();
});
