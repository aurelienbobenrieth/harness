import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-array-for-each";

it("reports Array#forEach", async () => {
  await expect(
    assertRuleReports(ruleName, "export const log = (rows: string[]) => rows.forEach((row) => console.log(row));\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.forEach and effect/Array forEach", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import * as Effect from "effect/Effect";',
        'import * as Arr from "effect/Array";',
        "export const loaded = Effect.forEach(ids, (id) => load(id), { concurrency: 1 });",
        "export const logged = Arr.forEach(ids, (id) => console.log(id));",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("reports forEach on a local that shadows an Effect module name", async () => {
  await expect(
    assertRuleReports(ruleName, 'const Effect = ["a"];\nEffect.forEach((value) => console.log(value));\n'),
  ).resolves.toBeUndefined();
});
