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

it("reports Effect.try function shorthand", async () => {
  await expect(
    assertRuleReports(ruleName, "const parsed = Effect.try(() => JSON.parse(input));\n"),
  ).resolves.toBeUndefined();
});

it("reports Effect.try object form without catch", async () => {
  await expect(
    assertRuleReports(ruleName, "const parsed = Effect.try({ try: () => JSON.parse(input) });\n"),
  ).resolves.toBeUndefined();
});

it("reports a namespace-imported tryPromise", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import * as T from "effect/Effect";\nconst response = T.tryPromise(() => fetch(url));\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows Effect.try with a catch handler", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const parsed = Effect.try({ try: () => JSON.parse(input), catch: (cause) => new ParseError({ cause }) });\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores try methods on other namespaces", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const parsed = Result.try(() => JSON.parse(input));\n"),
  ).resolves.toBeUndefined();
});

it("ignores a local object shadowing Effect", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const Effect = { tryPromise: (run: () => unknown) => run() };\nEffect.tryPromise(() => fetch(url));\n",
    ),
  ).resolves.toBeUndefined();
});
