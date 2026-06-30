import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-unscoped-runtime-launch";

it("reports Effect.runFork outside runtime boundaries", async () => {
  await expect(assertRuleReports(ruleName, "Effect.runFork(program);\n")).resolves.toBeUndefined();
});

it("reports Effect.runSync outside runtime boundaries", async () => {
  await expect(assertRuleReports(ruleName, "Effect.runSync(program);\n")).resolves.toBeUndefined();
});

it("reports Effect.runCallback outside runtime boundaries", async () => {
  await expect(assertRuleReports(ruleName, "Effect.runCallback(program, callback);\n")).resolves.toBeUndefined();
});

it("reports Layer.launch outside runtime boundaries", async () => {
  await expect(assertRuleReports(ruleName, "Layer.launch(AppLayer);\n")).resolves.toBeUndefined();
});

it("allows configured runtime boundary files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Layer.launch(AppLayer);\n", {
      filename: "src/main.ts",
      ruleConfig: ["error", { allow: ["**/src/main.ts"] }],
    }),
  ).resolves.toBeUndefined();
});

it("allows test files by default", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Effect.runFork(program);\n", {
      filename: "src/program.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores non-runtime calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "Effect.runPromise(program);\n")).resolves.toBeUndefined();
});
