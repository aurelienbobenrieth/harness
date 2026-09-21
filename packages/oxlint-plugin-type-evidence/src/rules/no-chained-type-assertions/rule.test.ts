import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/no-chained-type-assertions";

it("reports laundering a value through unknown", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const input: string;\nconst user = input as unknown as User;\n"),
  ).resolves.toBeUndefined();
});

it("reports parenthesized assertion chains", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const input: string;\nconst user = (input as unknown) as User;\n"),
  ).resolves.toBeUndefined();
});

it("reports angle-bracket assertion chains", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const input: string;\nconst user = <User>(<unknown>input);\n"),
  ).resolves.toBeUndefined();
});

it("reports chains of three assertions", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const input: string;\nconst user = input as unknown as object as User;\n"),
  ).resolves.toBeUndefined();
});

it("reports chains that end in as const", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const input: string;\nconst user = input as User as const;\n"),
  ).resolves.toBeUndefined();
});

it("allows a single assertion", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "declare const input: string;\nconst user = input as User;\n"),
  ).resolves.toBeUndefined();
});

it("allows a single as const assertion", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const pair = [1, 2] as const;\n")).resolves.toBeUndefined();
});

it("allows chains made only of as const", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const pair = [1, 2] as const as const;\n")).resolves.toBeUndefined();
});
