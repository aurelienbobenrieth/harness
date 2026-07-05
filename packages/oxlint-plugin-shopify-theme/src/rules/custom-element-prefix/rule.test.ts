import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-theme/custom-element-prefix";

it("reports custom elements without the default oio prefix", async () => {
  await expect(
    assertRuleReports(ruleName, 'customElements.define("theme-cart-drawer", class extends HTMLElement {});\n'),
  ).resolves.toBeUndefined();
});

it("accepts custom elements with the default oio prefix", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'customElements.define("oio-cart-drawer", class extends HTMLElement {});\n'),
  ).resolves.toBeUndefined();
});

it("reports window.customElements registrations without the prefix", async () => {
  await expect(
    assertRuleReports(ruleName, 'window.customElements.define("cart-drawer", class extends HTMLElement {});\n'),
  ).resolves.toBeUndefined();
});

it("honours a configured prefix", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'customElements.define("acme-cart", class extends HTMLElement {});\n', {
      ruleOptions: { prefix: "acme" },
    }),
  ).resolves.toBeUndefined();
});

it("ignores dynamic element names", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "customElements.define(name, class extends HTMLElement {});\n"),
  ).resolves.toBeUndefined();
});
