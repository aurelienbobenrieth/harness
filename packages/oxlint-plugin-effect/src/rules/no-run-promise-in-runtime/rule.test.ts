import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-run-promise-in-runtime";

it("reports Effect.runPromise outside configured boundaries", async () => {
  await expect(
    assertRuleReports(ruleName, "Effect.runPromise(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows Effect.runPromise in test files by default", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Effect.runPromise(program);\n", {
      filename: "apps/backend/src/features/example.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows Effect.runPromise in scripts by default", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Effect.runPromise(program);\n", {
      filename: "scripts/smoke.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows configured runtime boundaries", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Effect.runPromise(program);\n", {
      filename: "apps/backend/src/main.ts",
      ruleConfig: ["error", { allow: ["**/src/main.ts"] }],
    }),
  ).resolves.toBeUndefined();
});

it("ignores non-Effect runPromise calls", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Runtime.runPromise(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports curried Effect.runPromiseWith", async () => {
  await expect(
    assertRuleReports(ruleName, "Effect.runPromiseWith(services)(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports curried Effect.runPromiseExitWith", async () => {
  await expect(
    assertRuleReports(ruleName, "const exit = Effect.runPromiseExitWith(services)(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports an aliased Effect.runPromise", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { Effect as E } from "effect";\nE.runPromise(program);\n', {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports Effect.runPromise passed to pipe", async () => {
  await expect(
    assertRuleReports(ruleName, "const result = program.pipe(Effect.runPromise);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores non-Effect runPromiseWith calls", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Runtime.runPromiseWith(services)(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores a local object shadowing Effect", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const Effect = { runPromise: (value: unknown) => value };\nEffect.runPromise(program);\n",
      { filename: "apps/backend/src/features/example.ts" },
    ),
  ).resolves.toBeUndefined();
});

it("allows Effect.runPromiseWith in test files by default", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Effect.runPromiseWith(services)(program);\n", {
      filename: "apps/backend/src/features/example.test.ts",
    }),
  ).resolves.toBeUndefined();
});
