import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-theme/no-direct-cart-fetch";

it("reports direct Cart Ajax API fetches", async () => {
  await expect(
    assertRuleReports(ruleName, 'await fetch("/cart/add.js", { method: "POST" });\n'),
  ).resolves.toBeUndefined();
});

it("reports template-literal cart routes", async () => {
  await expect(
    assertRuleReports(ruleName, "await fetch(`${routes.cart_url}/cart/change.js`);\n"),
  ).resolves.toBeUndefined();
});

it("reports Storefront API fetches", async () => {
  await expect(assertRuleReports(ruleName, 'await fetch("/api/2026-04/graphql.json");\n')).resolves.toBeUndefined();
});

it("reports Section Rendering API fetches", async () => {
  await expect(
    assertRuleReports(ruleName, 'await fetch("/?sections=cart-drawer,cart-icon-bubble");\n'),
  ).resolves.toBeUndefined();
});

it("ignores unrelated fetches", async () => {
  await expect(assertRuleDoesNotReport(ruleName, 'await fetch("/search/suggest");\n')).resolves.toBeUndefined();
});

it("allows the configured wrapper module", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'await fetch("/cart/add.js", { method: "POST" });\n', {
      filename: "frontend/features/cart/cart-client.ts",
      ruleOptions: { allowIn: ["features/cart/"] },
    }),
  ).resolves.toBeUndefined();
});
