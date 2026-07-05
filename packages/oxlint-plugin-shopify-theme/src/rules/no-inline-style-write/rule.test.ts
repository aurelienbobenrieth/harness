import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-theme/no-inline-style-write";

it("reports inline writes to tokenized properties", async () => {
  await expect(assertRuleReports(ruleName, 'element.style.color = "red";\n')).resolves.toBeUndefined();
});

it("reports computed writes to tokenized properties", async () => {
  await expect(assertRuleReports(ruleName, 'element.style["marginTop"] = "8px";\n')).resolves.toBeUndefined();
});

it("allows setting CSS custom properties", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'element.style.setProperty("--theme-color-accent", value);\n'),
  ).resolves.toBeUndefined();
});

it("allows non-tokenized properties", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'element.style.transform = "translateX(10px)";\n'),
  ).resolves.toBeUndefined();
});

it("honours a configured property list", async () => {
  await expect(
    assertRuleReports(ruleName, 'element.style.transform = "translateX(10px)";\n', {
      ruleOptions: { properties: ["transform"] },
    }),
  ).resolves.toBeUndefined();
});
