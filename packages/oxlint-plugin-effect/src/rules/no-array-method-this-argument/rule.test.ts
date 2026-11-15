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

it("reports a thisArg after a callback on a native array", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "export const out = (rows: Row[], self: object) => rows.map(function (row) { return row; }, self);\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows data-first calls on capitalized namespaces and classes that are not arrays", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "export const next = Output.map(integration.id, (id) => `integrations/${id}`);",
        "export const user = Query.find(UserModel, { active: true });",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows a find or some whose first argument cannot be a callback", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'export const route = (router: Router) => router.find("GET", "/users");',
        "export const hit = (root: Collection) => root.find({ type: 'Import' }, 2);",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});
