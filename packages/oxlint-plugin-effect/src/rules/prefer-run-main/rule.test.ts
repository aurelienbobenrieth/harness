import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/prefer-run-main";

it("reports a top-level Effect.runPromise statement", async () => {
  await expect(assertRuleReports(ruleName, "Effect.runPromise(main);\n")).resolves.toBeUndefined();
});

it("reports through promise chains, void, await and pipe", async () => {
  await expect(
    assertRuleReports(ruleName, "Effect.runPromise(main).then(() => done()).catch(console.error);\n"),
  ).resolves.toBeUndefined();
  await expect(assertRuleReports(ruleName, "void Effect.runFork(main);\n")).resolves.toBeUndefined();
  await expect(assertRuleReports(ruleName, "await Effect.runPromise(main);\n")).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "main.pipe(Effect.provide(Live), Effect.runPromise);\n"),
  ).resolves.toBeUndefined();
});

it("allows runMain and function-local launches", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "NodeRuntime.runMain(main);",
        "main.pipe(Effect.provide(Live), NodeRuntime.runMain);",
        "export const handler = async () => { await Effect.runPromise(main); };",
        "export const result = Effect.runPromise(main);",
        "Other.runPromise(main);",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows scripts by default and configured entry files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "Effect.runPromise(main);\n", {
      filename: "scripts/seed.ts",
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, "Effect.runPromise(main);\n", {
      filename: "src/worker.ts",
      ruleOptions: { allow: ["**/worker.ts"] },
    }),
  ).resolves.toBeUndefined();
});
