import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, lintCode } from "../test-support.ts";

const ruleName = "effect/prefer-match";
const effectImport = 'import { Match } from "effect";\n';

it("reports a two-step chained literal ternary", async () => {
  await expect(
    assertRuleReports(ruleName, `${effectImport}const label = kind === "a" ? first : kind === "b" ? second : third;\n`),
  ).resolves.toBeUndefined();
});

it("reports member-expression subjects compared with loose equality", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${effectImport}const label = event.kind == 1 ? first : event.kind != 2 ? second : third;\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports the outermost ternary only", async () => {
  const code = `${effectImport}const label = kind === "a" ? a : kind === "b" ? b : kind === "c" ? c : d;\n`;
  const result = await lintCode(ruleName, code);
  const reportCount = (result.stdout.match(/"code":\s*"effect\(prefer-match\)"/gu) ?? []).length;

  expect(result.exitCode).not.toBe(0);
  expect(reportCount).toBe(1);
});

it("allows a single literal ternary", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, `${effectImport}const label = kind === "a" ? first : second;\n`),
  ).resolves.toBeUndefined();
});

it("allows chained ternaries testing different subjects", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${effectImport}const label = kind === "a" ? first : mode === "b" ? second : third;\n`,
    ),
  ).resolves.toBeUndefined();
});

it("allows chained ternaries without literal comparisons", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${effectImport}const label = kind === first ? one : kind === second ? two : three;\n`,
    ),
  ).resolves.toBeUndefined();
});

it("allows chained literal ternaries in files without an effect import", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const label = kind === "a" ? first : kind === "b" ? second : third;\n'),
  ).resolves.toBeUndefined();
});
