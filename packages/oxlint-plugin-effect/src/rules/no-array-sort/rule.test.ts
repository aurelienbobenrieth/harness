import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-array-sort";

it("reports Array#sort, which sorts in place", async () => {
  await expect(
    assertRuleReports(ruleName, "export const sorted = (rows: number[]) => rows.sort((a, b) => a - b);\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect's Arr.sort, data-first or data-last, which returns a new array", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import * as Arr from "effect/Array";',
        'import * as Order from "effect/Order";',
        "export const first = Arr.sort([2, 1], Order.Number);",
        "export const last = Arr.sort(Order.Number);",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows toSorted", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export const sorted = [2, 1].toSorted((a, b) => a - b);\n"),
  ).resolves.toBeUndefined();
});

it("reports a bare sort() and a sort with a comparator reference", async () => {
  await expect(
    assertRuleReports(ruleName, "export const keys = (record: object) => Object.keys(record).sort();\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "export const ordered = (rows: Row[]) => rows.sort(byDate);\n"),
  ).resolves.toBeUndefined();
});

it("allows a query builder's sort specification, which is not an array comparator", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "export const newest = (cursor: Cursor) => cursor.sort({ createdAt: -1 });",
        'export const named = (cursor: Cursor) => cursor.sort("name");',
        'export const pair = (cursor: Cursor) => cursor.sort("name", "desc");',
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});
