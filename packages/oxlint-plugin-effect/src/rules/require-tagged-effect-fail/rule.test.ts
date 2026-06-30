import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/require-tagged-effect-fail";

it("reports string literal failures", async () => {
  await expect(assertRuleReports(ruleName, 'const program = Effect.fail("boom");\n')).resolves.toBeUndefined();
});

it("reports object literal failures", async () => {
  await expect(
    assertRuleReports(ruleName, 'const program = Effect.fail({ reason: "boom" });\n'),
  ).resolves.toBeUndefined();
});

it("reports array literal failures", async () => {
  await expect(assertRuleReports(ruleName, 'const program = Effect.fail(["boom"]);\n')).resolves.toBeUndefined();
});

it("reports template literal failures", async () => {
  await expect(assertRuleReports(ruleName, "const program = Effect.fail(`boom`);\n")).resolves.toBeUndefined();
});

it("allows constructed typed failures", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const program = Effect.fail(new DomainError({ reason }));\n"),
  ).resolves.toBeUndefined();
});

it("allows named typed failures", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const program = Effect.fail(error);\n")).resolves.toBeUndefined();
});

it("ignores non-Effect fail calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, 'const program = Result.fail("boom");\n')).resolves.toBeUndefined();
});
