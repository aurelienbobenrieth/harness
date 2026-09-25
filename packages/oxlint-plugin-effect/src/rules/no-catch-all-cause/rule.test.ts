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

it("reports Effect.ignoreCause in a pipe and as a direct call", async () => {
  await expect(
    assertRuleReports(ruleName, "const warm = warmCache.pipe(Effect.ignoreCause({ log: true }));\n"),
  ).resolves.toBeUndefined();
  await expect(assertRuleReports(ruleName, "const warm = Effect.ignoreCause(warmCache);\n")).resolves.toBeUndefined();
});

it("reports Effect.catchDefect", async () => {
  await expect(
    assertRuleReports(ruleName, "const safe = program.pipe(Effect.catchDefect(() => Effect.succeed(fallback)));\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.ignore, which leaves defects and interruption alone", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const warm = warmCache.pipe(Effect.ignore({ log: true }));\n"),
  ).resolves.toBeUndefined();
});

it("ignores ignoreCause and catchDefect on non-Effect objects", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const a = queue.ignoreCause(job);\nconst b = custom.catchDefect(() => fallback);\n",
    ),
  ).resolves.toBeUndefined();
});
