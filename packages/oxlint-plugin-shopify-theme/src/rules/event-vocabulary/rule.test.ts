import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-theme/event-vocabulary";

it("reports CustomEvent names outside the vocabulary prefixes", async () => {
  await expect(
    assertRuleReports(ruleName, 'document.dispatchEvent(new CustomEvent("cart-updated"));\n'),
  ).resolves.toBeUndefined();
});

it("accepts oio-namespaced CustomEvent names", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'document.dispatchEvent(new CustomEvent("oio:cart:updated"));\n'),
  ).resolves.toBeUndefined();
});

it("accepts Shopify standard event names", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'document.dispatchEvent(new CustomEvent("shopify:cart:lines-update"));\n'),
  ).resolves.toBeUndefined();
});

it("accepts vocabulary constants for CustomEvent names", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "document.dispatchEvent(new CustomEvent(CART_UPDATED));\n"),
  ).resolves.toBeUndefined();
});

it("reports namespaced listeners outside the vocabulary prefixes", async () => {
  await expect(
    assertRuleReports(ruleName, 'document.addEventListener("theme:cart:updated", () => {});\n'),
  ).resolves.toBeUndefined();
});

it("ignores native DOM event listeners", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'button.addEventListener("click", () => {});\n'),
  ).resolves.toBeUndefined();
});

it("honours configured prefixes", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'document.dispatchEvent(new CustomEvent("acme:ready"));\n', {
      ruleOptions: { allowedPrefixes: ["acme:"] },
    }),
  ).resolves.toBeUndefined();
});
