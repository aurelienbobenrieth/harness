import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "lit/no-shadow-dom";

it("reports LitElement subclasses without createRenderRoot", async () => {
  await expect(
    assertRuleReports(ruleName, "class CartDrawer extends LitElement {\n  render() {\n    return null;\n  }\n}\n"),
  ).resolves.toBeUndefined();
});

it("reports createRenderRoot that does not return this", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "class CartDrawer extends LitElement {\n  createRenderRoot() {\n    return super.createRenderRoot();\n  }\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("accepts createRenderRoot returning this", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "class CartDrawer extends LitElement {\n  createRenderRoot() {\n    return this;\n  }\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("accepts subclasses of a configured light DOM base class", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "class CartDrawer extends BaseElement {\n  render() {\n    return null;\n  }\n}\n",
      {
        ruleOptions: { lightDomBaseClasses: ["BaseElement"] },
      },
    ),
  ).resolves.toBeUndefined();
});

it("checks configured base classes", async () => {
  await expect(
    assertRuleReports(ruleName, "class CartDrawer extends ThemeElement {\n  render() {\n    return null;\n  }\n}\n", {
      ruleOptions: { baseClasses: ["ThemeElement"] },
    }),
  ).resolves.toBeUndefined();
});

it("ignores classes without a superclass", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "class Helper {\n  run() {\n    return 1;\n  }\n}\n"),
  ).resolves.toBeUndefined();
});
