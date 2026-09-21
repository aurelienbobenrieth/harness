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

it("reports an aliased Effect.catchCause", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { Effect as E } from "effect";\nconst safe = program.pipe(E.catchCause(() => E.void));\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports Effect.catchCauseIf", async () => {
  await expect(
    assertRuleReports(ruleName, "const safe = program.pipe(Effect.catchCauseIf(Cause.hasDies, () => Effect.void));\n"),
  ).resolves.toBeUndefined();
});

it("reports Effect.catchCauseFilter", async () => {
  await expect(
    assertRuleReports(ruleName, "const safe = program.pipe(Effect.catchCauseFilter(filter, () => Effect.void));\n"),
  ).resolves.toBeUndefined();
});

it("reports Effect.sandbox", async () => {
  await expect(
    assertRuleReports(ruleName, "const safe = program.pipe(Effect.sandbox, Effect.catch(() => Effect.void));\n"),
  ).resolves.toBeUndefined();
});

it("reports Layer.catchCause", async () => {
  await expect(
    assertRuleReports(ruleName, "const SafeLive = AppLive.pipe(Layer.catchCause(() => FallbackLive));\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.catch and Effect.matchCause", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const safe = program.pipe(Effect.catch(() => fallback), Effect.matchCause({ onFailure: render, onSuccess: render }));\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores catchCause on a local object shadowing Effect", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const Effect = { catchCause: (value: unknown) => value };\nconst safe = Effect.catchCause(program);\n",
    ),
  ).resolves.toBeUndefined();
});
