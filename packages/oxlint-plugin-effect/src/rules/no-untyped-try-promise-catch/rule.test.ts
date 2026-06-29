import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-untyped-try-promise-catch";

it("reports Effect.tryPromise function shorthand", async () => {
  await expect(assertRuleReports(ruleName, "Effect.tryPromise(() => fetch(url));\n")).resolves.toBeUndefined();
});

it("reports Effect.tryPromise object form without catch", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `
Effect.tryPromise({
  try: () => fetch(url),
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("allows Effect.tryPromise object form with catch", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `
Effect.tryPromise({
  try: () => fetch(url),
  catch: (cause) => new FetchError({ cause }),
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("allows quoted catch properties", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `
Effect.tryPromise({
  try: () => fetch(url),
  "catch": (cause) => new FetchError({ cause }),
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores non-Effect tryPromise calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "Task.tryPromise(() => fetch(url));\n")).resolves.toBeUndefined();
});
