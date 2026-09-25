import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-dynamic-span-name";

it("reports an interpolated Effect.fn span name", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const load = (id: string) => Effect.fn(`users.load.${id}`)(function* () { return yield* find(id); });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports interpolated Effect.withSpan names data-last and data-first", async () => {
  await expect(
    assertRuleReports(ruleName, "const traced = load.pipe(Effect.withSpan(`GET /users/${userId}`));\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, 'const traced = Effect.withSpan(load, "users." + userId);\n'),
  ).resolves.toBeUndefined();
});

it("reports dynamic names on useSpan, Layer.withSpan, and Stream.withSpan", async () => {
  await expect(
    assertRuleReports(ruleName, "const a = Effect.useSpan(`job.${job.id}`, (span) => run(span));\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const b = DbLive.pipe(Layer.withSpan(`db.${tenant}`));\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, 'const c = events.pipe(Stream.withSpan("events." + topic));\n'),
  ).resolves.toBeUndefined();
});

it("allows fixed span names with values in attributes", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const load = Effect.fn("users.load")(function* (id: string) { return yield* find(id); });',
        'const traced = load.pipe(Effect.withSpan("GET /users/:id", { attributes: { userId } }));',
        "const plain = Effect.withSpan(load, `users.list`);",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows names composed only from const strings", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const prefix = "UserRepo";',
        "const findById = Effect.fn(`${prefix}.findById`)(function* () { return yield* find(); });",
        'const traced = load.pipe(Effect.withSpan(prefix + ".list"));',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("ignores span-like methods on non-Effect objects", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const traced = tracer.withSpan(`job.${id}`, run);\n"),
  ).resolves.toBeUndefined();
});
