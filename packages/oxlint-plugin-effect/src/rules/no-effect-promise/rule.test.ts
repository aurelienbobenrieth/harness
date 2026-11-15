import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-effect-promise";

it("reports Effect.promise around rejectable work", async () => {
  await expect(assertRuleReports(ruleName, "const res = Effect.promise(() => fetch(url));\n")).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const rows = Effect.promise(async () => { return db.query(sql); });\n"),
  ).resolves.toBeUndefined();
});

it("resolves namespace aliases", async () => {
  await expect(
    assertRuleReports(ruleName, 'import * as T from "effect/Effect";\nconst rows = T.promise(() => db.query(sql));\n'),
  ).resolves.toBeUndefined();
});

it("reports a new Promise that can reject", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const done = Effect.promise(() => new Promise((resolve, reject) => stream.on('error', reject)));\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows syntactically total promises", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = Effect.promise(() => Promise.resolve(1));",
        "const b = Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 10)));",
        "const c = Effect.promise(() => scheduler.yield());",
        "const d = Other.promise(() => fetch(url));",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows configured files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const res = Effect.promise(() => fetch(url));\n", {
      filename: "src/legacy/adapter.ts",
      ruleOptions: { allow: ["**/legacy/**"] },
    }),
  ).resolves.toBeUndefined();
});

it("narrows to visibly rejectable thunks in rejectable-only mode", async () => {
  const config = { ruleOptions: { mode: "rejectable-only" } } as const;
  await expect(
    assertRuleReports(ruleName, "const body = Effect.promise(() => response.json());\n", config),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, "const value = Effect.promise(() => compute(input));\n", config),
  ).resolves.toBeUndefined();
});

it("allows Effect.promise in finalizers, whose error channel must stay empty", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = Effect.acquireRelease(open, (pg) => Effect.promise(() => pg.close()).pipe(Effect.timeoutOption(1000)));",
        "const b = Effect.acquireUseRelease(open, use, (pg) => Effect.promise(() => pg.end()));",
        "const c = program.pipe(Effect.ensuring(Effect.promise(() => provider.shutdown())));",
        "const d = Effect.addFinalizer(() => Effect.promise(() => server.close()));",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("still reports Effect.promise in the acquire and use positions", async () => {
  await expect(
    assertRuleReports(ruleName, "const a = Effect.acquireRelease(Effect.promise(() => connect()), close);\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "const b = Effect.acquireUseRelease(open, (pg) => Effect.promise(() => pg.query(sql)), close);\n",
    ),
  ).resolves.toBeUndefined();
});

it("skips test files and test-support folders by default", async () => {
  await Promise.all(
    ["src/store.test.ts", "src/testing/seed.ts", "src/__tests__/db.ts"].map(async (filename) => {
      await expect(
        assertRuleDoesNotReport(ruleName, "const res = Effect.promise(() => fetch(url));\n", { filename }),
      ).resolves.toBeUndefined();
    }),
  );
  await expect(
    assertRuleReports(ruleName, "const res = Effect.promise(() => fetch(url));\n", { filename: "src/testimonials.ts" }),
  ).resolves.toBeUndefined();
});
