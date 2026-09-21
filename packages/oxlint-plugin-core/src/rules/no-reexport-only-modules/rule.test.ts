import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-reexport-only-modules";
const reexportOnly = 'export * from "./user.js";\nexport { load } from "./load.js";\n';

it("reports modules that only re-export", async () => {
  await expect(assertRuleReports(ruleName, reexportOnly, { filename: "models.ts" })).resolves.toBeUndefined();
});

it("reports re-export-only modules that mix imports and lone empty exports", async () => {
  await expect(
    assertRuleReports(ruleName, 'import "./register.js";\nexport * from "./user.js";\nexport {};\n', {
      filename: "models.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows index.ts barrels by default", async () => {
  await expect(assertRuleDoesNotReport(ruleName, reexportOnly, { filename: "index.ts" })).resolves.toBeUndefined();
});

it("allows modules with any own declaration", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'export * from "./user.js";\nexport const version = 1;\n', {
      filename: "models.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows modules without re-exports", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import "./side-effect.js";\n', { filename: "register.ts" }),
  ).resolves.toBeUndefined();
});

it("allows filenames listed in the allow option", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, reexportOnly, {
      filename: "barrel.ts",
      ruleOptions: { allow: ["barrel.ts"] },
    }),
  ).resolves.toBeUndefined();
});

it("reports index.ts when the allow option replaces the default", async () => {
  await expect(
    assertRuleReports(ruleName, reexportOnly, {
      filename: "index.ts",
      ruleOptions: { allow: ["barrel.ts"] },
    }),
  ).resolves.toBeUndefined();
});
