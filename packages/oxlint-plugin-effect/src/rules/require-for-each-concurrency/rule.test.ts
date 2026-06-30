import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/require-for-each-concurrency";

it("reports Effect.forEach without options", async () => {
  await expect(
    assertRuleReports(ruleName, "const values = Effect.forEach(items, processItem);\n"),
  ).resolves.toBeUndefined();
});

it("reports Effect.forEach options without concurrency", async () => {
  await expect(
    assertRuleReports(ruleName, "const values = Effect.forEach(items, processItem, { discard: true });\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.forEach with numeric concurrency", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const values = Effect.forEach(items, processItem, { concurrency: 1 });\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.forEach with named concurrency", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const values = Effect.forEach(items, processItem, { concurrency: SyncConcurrency.items });\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows quoted concurrency option keys", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const values = Effect.forEach(items, processItem, { "concurrency": 1 });\n'),
  ).resolves.toBeUndefined();
});

it("ignores non-Effect forEach calls", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const values = Array.forEach(items, processItem);\n"),
  ).resolves.toBeUndefined();
});
