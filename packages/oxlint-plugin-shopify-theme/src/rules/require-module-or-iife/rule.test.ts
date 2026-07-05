import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-theme/require-module-or-iife";

it("reports top-level declarations in classic scripts", async () => {
  await expect(
    assertRuleReports(ruleName, "var cartCount = 0;\nfunction updateCart() {\n  cartCount += 1;\n}\n", {
      filename: "cart.js",
    }),
  ).resolves.toBeUndefined();
});

it("ignores scripts wrapped in an IIFE", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "(function () {\n  var cartCount = 0;\n  console.log(cartCount);\n})();\n", {
      filename: "cart.js",
    }),
  ).resolves.toBeUndefined();
});

it("ignores deliberate global bridges", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'window.theme = { moneyFormat: "{{amount}}" };\ncustomElements.define("cart-drawer", class extends HTMLElement {});\n',
      { filename: "globals.js" },
    ),
  ).resolves.toBeUndefined();
});

it("ignores module scripts", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Component } from "@theme/component";\nconst cartCount = 0;\nconsole.log(Component, cartCount);\n',
      { filename: "cart.js" },
    ),
  ).resolves.toBeUndefined();
});
