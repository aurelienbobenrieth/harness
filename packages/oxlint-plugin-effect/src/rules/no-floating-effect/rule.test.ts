import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-floating-effect";

it("reports ignored Effect calls", async () => {
  await expect(assertRuleReports(ruleName, "Effect.succeed(value);\n")).resolves.toBeUndefined();
});

it("reports ignored Effect pipelines", async () => {
  await expect(assertRuleReports(ruleName, "Effect.gen(function* () {});\n")).resolves.toBeUndefined();
});

it("allows returned Effect values", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "return Effect.succeed(value);\n")).resolves.toBeUndefined();
});

it("allows assigned Effect values", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const program = Effect.succeed(value);\n")).resolves.toBeUndefined();
});

it("allows yielded Effect values", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `
const program = Effect.gen(function* () {
  const value = yield* Effect.succeed(1);
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("allows composed Effect values", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `
pipe(
  Effect.succeed(value),
  Effect.map((value) => value + 1),
);
`,
    ),
  ).resolves.toBeUndefined();
});

it("allows runtime boundary calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "Effect.runPromise(program);\n")).resolves.toBeUndefined();
});

it("allows standalone Effect log calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "Effect.logInfo(message);\n")).resolves.toBeUndefined();
});
