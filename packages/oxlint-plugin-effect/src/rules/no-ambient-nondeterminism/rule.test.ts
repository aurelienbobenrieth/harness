import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-ambient-nondeterminism";
const effectImport = 'import { Effect } from "effect";\n';

it("reports Date.now in Effect files", async () => {
  await expect(assertRuleReports(ruleName, `${effectImport}const timestamp = Date.now();\n`)).resolves.toBeUndefined();
});

it("reports zero-argument new Date in Effect files", async () => {
  await expect(assertRuleReports(ruleName, `${effectImport}const started = new Date();\n`)).resolves.toBeUndefined();
});

it("reports Math.random in Effect files", async () => {
  await expect(assertRuleReports(ruleName, `${effectImport}const seed = Math.random();\n`)).resolves.toBeUndefined();
});

it("reports crypto.randomUUID in Effect files", async () => {
  await expect(
    assertRuleReports(ruleName, `${effectImport}const id = crypto.randomUUID();\n`),
  ).resolves.toBeUndefined();
});

it("reports globalThis-qualified crypto.getRandomValues in Effect files", async () => {
  await expect(
    assertRuleReports(ruleName, `${effectImport}const bytes = globalThis.crypto.getRandomValues(buffer);\n`),
  ).resolves.toBeUndefined();
});

it("reports ambient reads in files importing effect subpaths", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { Result } from "effect/unstable/data";\nconst timestamp = Date.now();\n'),
  ).resolves.toBeUndefined();
});

it("allows new Date built from explicit input", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, `${effectImport}const parsed = new Date(input);\n`),
  ).resolves.toBeUndefined();
});

it("allows ambient reads in files without an effect import", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const timestamp = Date.now();\nconst seed = Math.random();\n"),
  ).resolves.toBeUndefined();
});

it("reports performance.now in Effect files", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { Effect } from "effect";\nconst started = performance.now();\n'),
  ).resolves.toBeUndefined();
});

it("ignores performance.now outside Effect files", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const started = performance.now();\n")).resolves.toBeUndefined();
});

it("ignores a locally bound performance object", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Effect } from "effect";\nimport { performance } from "./test-clock";\nconst started = performance.now();\n',
    ),
  ).resolves.toBeUndefined();
});
