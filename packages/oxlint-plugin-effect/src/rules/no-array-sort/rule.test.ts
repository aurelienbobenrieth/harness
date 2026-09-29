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
