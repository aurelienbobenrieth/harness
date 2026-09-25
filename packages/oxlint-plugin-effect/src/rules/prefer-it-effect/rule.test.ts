import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/prefer-it-effect";
const testFile = { filename: "src/user.test.ts" } as const;

it("reports Effect.runPromise inside a plain test callback", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'it("loads", async () => { const user = await Effect.runPromise(load.pipe(Effect.provide(TestLayer))); expect(user).toBeDefined(); });\n',
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it("reports under test modifiers such as only and each", async () => {
  await expect(
    assertRuleReports(ruleName, 'test.only("sync", () => { expect(Effect.runSync(program)).toBe(1); });\n', testFile),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'it.each([1, 2])("case %i", async (n) => { await Effect.runPromiseExit(run(n)); });\n',
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows Effect-aware tests, hooks and runtime instances", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'it.effect("loads", () => Effect.gen(function* () { const user = yield* load; expect(user).toBeDefined(); }));',
        "beforeAll(async () => { await Effect.runPromise(seed); });",
        'it("adapter", async () => { await runtime.runPromise(handler); });',
        'it.live("boundary", () => Effect.sync(() => Effect.runSync(inner)));',
        "",
      ].join("\n"),
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it("stays silent outside test files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'it("loads", async () => { await Effect.runPromise(load); });\n', {
      filename: "src/user.ts",
    }),
  ).resolves.toBeUndefined();
});
