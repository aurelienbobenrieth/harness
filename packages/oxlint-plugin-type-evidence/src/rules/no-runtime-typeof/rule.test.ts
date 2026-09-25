import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/no-runtime-typeof";

it("reports typeof used as a value", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const value: string;\nconst kind = typeof value;\n"),
  ).resolves.toBeUndefined();
});

it("reports typeof comparisons against primitive names", async () => {
  await expect(
    assertRuleReports(ruleName, 'declare const value: string;\nif (typeof value === "string") {\n  use(value);\n}\n'),
  ).resolves.toBeUndefined();
});

it("reports typeof switch discriminants", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const value: string;\nswitch (typeof value) {\n  default:\n    break;\n}\n"),
  ).resolves.toBeUndefined();
});

it("reports typeof inside type guards when the option is disabled", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'function isString(value: unknown): value is string { return typeof value === "string"; }\n',
      { ruleOptions: { allowInTypeGuards: false } },
    ),
  ).resolves.toBeUndefined();
});

it("allows existence probes against undefined", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'if (typeof window !== "undefined") {\n  boot();\n}\n'),
  ).resolves.toBeUndefined();
});

it("allows reversed existence probes", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'if ("undefined" === typeof window) {\n  fallback();\n}\n'),
  ).resolves.toBeUndefined();
});

it("allows parenthesized existence probes", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'if ((typeof window) != "undefined") {\n  boot();\n}\n'),
  ).resolves.toBeUndefined();
});

it("allows typeof inside type guard functions by default", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'function isString(value: unknown): value is string { return typeof value === "string"; }\n',
    ),
  ).resolves.toBeUndefined();
});
