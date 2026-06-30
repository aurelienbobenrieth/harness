import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-catch-all-cause";

it("reports Effect.catchAllCause", async () => {
  await expect(
    assertRuleReports(ruleName, "const program = effect.pipe(Effect.catchAllCause((cause) => Effect.fail(cause)));\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.catchAll", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const program = effect.pipe(Effect.catchAll((error) => Effect.fail(error)));\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.catchTag", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const program = effect.pipe(Effect.catchTag("DomainError", handle));\n'),
  ).resolves.toBeUndefined();
});

it("ignores non-Effect catchAllCause members", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const program = custom.catchAllCause((cause) => handle(cause));\n"),
  ).resolves.toBeUndefined();
});
