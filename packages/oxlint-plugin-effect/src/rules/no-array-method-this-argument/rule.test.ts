import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-array-method-this-argument";

it("reports the thisArg of a native array method", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "export const kept = (rows: number[]) => rows.filter(function () { return true; }, context);\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows Effect's data-first helpers, whose second argument is the callback", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import * as Arr from "effect/Array";',
        'import { Effect } from "effect";',
        "export const kept = Arr.filter([1, 2], (n) => n > 1);",
        "export const loaded = Effect.forEach([1, 2], (n) => Effect.succeed(n));",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows a native array method with its callback only", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export const doubled = [1, 2].map((n) => n * 2);\n"),
  ).resolves.toBeUndefined();
});
