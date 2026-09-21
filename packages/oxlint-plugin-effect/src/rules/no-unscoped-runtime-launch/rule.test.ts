import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-unscoped-runtime-launch";

it("reports Effect.runFork outside runtime boundaries", async () => {
  await expect(assertRuleReports(ruleName, "Effect.runFork(program);\n")).resolves.toBeUndefined();
});

it("reports Effect.runSync outside runtime boundaries", async () => {
  await expect(assertRuleReports(ruleName, "Effect.runSync(program);\n")).resolves.toBeUndefined();
});

it("reports Effect.runCallback outside runtime boundaries", async () => {
  await expect(assertRuleReports(ruleName, "Effect.runCallback(program, callback);\n")).resolves.toBeUndefined();
});

it("reports Layer.launch outside runtime boundaries", async () => {
  await expect(assertRuleReports(ruleName, "Layer.launch(AppLayer);\n")).resolves.toBeUndefined();
});

it("allows configured runtime boundary files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Layer.launch(AppLayer);\n", {
      filename: "src/main.ts",
      ruleConfig: ["error", { allow: ["**/src/main.ts"] }],
    }),
  ).resolves.toBeUndefined();
});

it("allows test files by default", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Effect.runFork(program);\n", {
      filename: "src/program.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores non-runtime calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "Effect.runPromise(program);\n")).resolves.toBeUndefined();
});

it("reports curried Effect.runForkWith", async () => {
  await expect(
    assertRuleReports(ruleName, "Effect.runForkWith(services)(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports curried Effect.runSyncWith", async () => {
  await expect(
    assertRuleReports(ruleName, "const value = Effect.runSyncWith(services)(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports curried Effect.runSyncExitWith", async () => {
  await expect(
    assertRuleReports(ruleName, "const exit = Effect.runSyncExitWith(services)(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports curried Effect.runCallbackWith", async () => {
  await expect(
    assertRuleReports(ruleName, "Effect.runCallbackWith(services)(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports Effect.runFork passed to pipe", async () => {
  await expect(
    assertRuleReports(ruleName, "const fiber = program.pipe(Effect.runFork);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports an aliased Layer.launch", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { Layer as L } from "effect";\nconst main = L.launch(AppLive);\n', {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports a namespace-imported Effect.runSync", async () => {
  await expect(
    assertRuleReports(ruleName, 'import * as T from "effect/Effect";\nconst value = T.runSync(program);\n', {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores a local object shadowing Layer", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const Layer = { launch: (value: unknown) => value };\nLayer.launch(AppLive);\n",
      { filename: "apps/backend/src/features/example.ts" },
    ),
  ).resolves.toBeUndefined();
});

it("ignores non-Effect runForkWith calls", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Runtime.runForkWith(services)(program);\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});
