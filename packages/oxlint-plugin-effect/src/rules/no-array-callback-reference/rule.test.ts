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
    assertRuleReports(ruleName, "const rows: string[] = []; rows.filter(guards.isValid);\n"),
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

it("allows global conversion functions that read one argument", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'export const ids = "1,2".split(",").map(Number);',
        "export const labels = [1, 2].map(String);",
        "export const big = [1, 2].map(BigInt);",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows a function declared in the file with no parameter for the index", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "function toReceipt(row: Row): Receipt { return { id: row.id }; }",
        "const isTracked = (path: string): boolean => path.length > 0;",
        "const merge = (accumulator: Totals, row: Row): Totals => accumulator;",
        "export const receipts = (rows: Row[]) => rows.map(toReceipt);",
        "export const tracked = (paths: string[]) => paths.filter(isTracked);",
        "export const totals = (rows: Row[]) => rows.reduce(merge, {});",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("reports a local function that takes a second parameter, a variadic one and an imported reference", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const parse = (text: string, radix = 10) => parseInt(text, radix);\nexport const numbers = ['1', '2'].map(parse);\n",
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "const join = (...parts: string[]) => parts.join();\nexport const joined = ['1', '2'].map(join);\n",
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, 'import { parse } from "./parse";\nexport const numbers = ["1"].map(parse);\n'),
  ).resolves.toBeUndefined();
});

it("reports a three-parameter reducer reference and a shadowed Number", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const merge = (total: number, row: number, index: number) => total + row + index;\nexport const sum = [1].reduce(merge, 0);\n",
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "const Number = (text: string, radix: number) => radix;\nexport const out = ['1'].map(Number);\n",
    ),
  ).resolves.toBeUndefined();
});

it.each([
  "rows.map(Math.cos)",
  "rows.map(decodeURIComponent)",
  "rows.map(normalizeDomain)",
  "rows.findLastIndex(isTurnStart)",
])("reports %s without an Effect import", async (call) => {
  await assertRuleReports(ruleName, `const rows: string[] = []; ${call};`, {
    filename: "src/utils.ts",
  });
});
