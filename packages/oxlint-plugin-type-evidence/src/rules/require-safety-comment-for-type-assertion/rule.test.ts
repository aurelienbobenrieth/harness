import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/require-safety-comment-for-type-assertion";

it("reports assertions without a safety comment", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const input: string;\nconst user = input as User;\n"),
  ).resolves.toBeUndefined();
});

it("reports empty safety comments", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const input: string;\n// SAFETY:\nconst user = input as User;\n"),
  ).resolves.toBeUndefined();
});

it("reports trailing same-line safety comments", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const input: string;\nconst user = input as User; // SAFETY: verified\n"),
  ).resolves.toBeUndefined();
});

it("reports default markers when custom markers are configured", async () => {
  await expect(
    assertRuleReports(ruleName, "declare const input: string;\n// SAFETY: verified\nconst user = input as User;\n", {
      ruleOptions: { markers: ["JUSTIFIED"] },
    }),
  ).resolves.toBeUndefined();
});

it("allows assertions preceded by a safety comment", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "declare const input: string;\n// SAFETY: input validated upstream\nconst user = input as User;\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows safety comments before exported declarations", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "declare const input: string;\n// SAFETY: parsed by schema\nexport const user = input as User;\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows safety comments inside the owning statement", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "declare const input: string;\nconst user = /* SAFETY: validated by PayloadSchema */ input as User;\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows as const without a comment", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const pair = [1, 2] as const;\n")).resolves.toBeUndefined();
});

it("allows safety comments before return statements", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "function handle(input: Raw) {\n  // SAFETY: validated by caller\n  return input as User;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows configured custom markers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "declare const input: string;\n// JUSTIFIED: reviewed in #42\nconst user = input as User;\n",
      { ruleOptions: { markers: ["JUSTIFIED"] } },
    ),
  ).resolves.toBeUndefined();
});

it("rejects placeholder safety reasons", async () => {
  await assertRuleReports(ruleName, "// SAFETY: x\nconst user = input as User;");
  await assertRuleReports(ruleName, "// SAFETY: TODO explain this later\nconst user = input as User;");
});
