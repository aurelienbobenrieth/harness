import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/prefer-effect-array-helpers";

it("reports native array map calls in source files", async () => {
  await expect(
    assertRuleReports(ruleName, "const names = users.map((user) => user.name);\n", {
      filename: "packages/core/src/users.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports native array reduce calls in source files", async () => {
  await expect(
    assertRuleReports(ruleName, "const total = items.reduce((sum, item) => sum + item.count, 0);\n", {
      filename: "packages/core/src/items.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows Effect helpers", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const names = Effect.forEach(users, userName);\n", {
      filename: "packages/core/src/users.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows ignored object helpers", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const values = Option.map(value, fn);\n", {
      filename: "packages/core/src/users.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows configured escape-hatch files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const names = users.map((user) => user.name);\n", {
      filename: "packages/core/src/legacy/users.ts",
      ruleConfig: ["error", { allow: ["**/legacy/**"] }],
    }),
  ).resolves.toBeUndefined();
});

it("allows configured ignored objects", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const names = users.map((user) => user.name);\n", {
      filename: "packages/core/src/users.ts",
      ruleConfig: ["error", { ignoredObjects: ["users"] }],
    }),
  ).resolves.toBeUndefined();
});
