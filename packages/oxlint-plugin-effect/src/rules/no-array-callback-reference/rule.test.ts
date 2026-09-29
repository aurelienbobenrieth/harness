import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-array-callback-reference";

it("reports a function reference passed to a native array method", async () => {
  await expect(
    assertRuleReports(ruleName, 'export const numbers = ["1", "2"].map(parseInt);\n'),
  ).resolves.toBeUndefined();
});

it("reports a member reference passed to a native array method", async () => {
  await expect(
    assertRuleReports(ruleName, "export const kept = (rows: string[]) => rows.filter(guards.isValid);\n"),
  ).resolves.toBeUndefined();
});

it("reports a function reference passed to an effect/Array helper, which also passes the index", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import * as Arr from "effect/Array";\nexport const numbers = Arr.map(["1", "2"], parseInt);\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows Option.some and Option.filter, which take a value or a one-argument predicate", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import * as Option from "effect/Option";',
        "declare const isRunning: (value: string) => boolean;",
        "export const some = Option.some(error.lastError);",
        'export const running = Option.filter(Option.some("a"), isRunning);',
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows Effect.forEach imported by name from effect", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Effect } from "effect";\nexport const all = Effect.forEach(ids, load);\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows inline callbacks and filter(Boolean)", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'export const numbers = ["1", "2"].map((text) => Number(text));\nexport const present = [0, 1].filter(Boolean);\n',
    ),
  ).resolves.toBeUndefined();
});
