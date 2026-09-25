import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-let";

it("reports let declarations", async () => {
  await expect(assertRuleReports(ruleName, "let total = 0;\ntotal += 1;\n")).resolves.toBeUndefined();
});

it("reports var declarations", async () => {
  await expect(assertRuleReports(ruleName, "var total = 0;\ntotal += 1;\n")).resolves.toBeUndefined();
});

it("reports let declarations in loop heads", async () => {
  await expect(
    assertRuleReports(ruleName, "for (let index = 0; index < 3; index += 1) {\n  run(index);\n}\n"),
  ).resolves.toBeUndefined();
});

it("allows const declarations", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const total = 0;\nexport { total };\n")).resolves.toBeUndefined();
});
