import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/require-named-effect-fn";

it("reports unnamed Effect.fn", async () => {
  await expect(
    assertRuleReports(ruleName, "const run = Effect.fn(function* () { return 1; });\n"),
  ).resolves.toBeUndefined();
});

it("reports empty Effect.fn names", async () => {
  await expect(
    assertRuleReports(ruleName, 'const run = Effect.fn("", function* () { return 1; });\n'),
  ).resolves.toBeUndefined();
});

it("allows named Effect.fn", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const run = Effect.fn("service.run", function* () { return 1; });\n'),
  ).resolves.toBeUndefined();
});

it("ignores non-Effect fn calls", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const run = Other.fn(function* () { return 1; });\n"),
  ).resolves.toBeUndefined();
});
