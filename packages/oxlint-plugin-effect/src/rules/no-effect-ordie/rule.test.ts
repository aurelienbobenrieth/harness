import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-effect-ordie";

it("reports Effect.orDie", async () => {
  await expect(assertRuleReports(ruleName, "const program = Effect.orDie(loadUser);\n")).resolves.toBeUndefined();
});

it("reports Effect.orDieWith", async () => {
  await expect(
    assertRuleReports(ruleName, "const program = Effect.orDieWith(loadUser, (error) => error);\n"),
  ).resolves.toBeUndefined();
});

it("allows non-Effect orDie calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const program = Other.orDie(loadUser);\n")).resolves.toBeUndefined();
});

it("allows configured files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const program = Effect.orDie(loadUser);\n", {
      filename: "test-fixtures/defects.ts",
      ruleConfig: ["error", { allow: ["**/test-fixtures/**"] }],
    }),
  ).resolves.toBeUndefined();
});

it("allows configured call names", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const program = Effect.orDie(loadUser);\n", {
      ruleConfig: ["error", { allowedCalls: ["orDie"] }],
    }),
  ).resolves.toBeUndefined();
});
