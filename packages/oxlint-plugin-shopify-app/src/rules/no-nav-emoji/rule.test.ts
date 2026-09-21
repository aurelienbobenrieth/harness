import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-nav-emoji";
const filename = "sample.tsx";

it("reports emoji inside navigation links", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export const nav = (\n  <s-app-nav>\n    <s-link href="/orders">📦 Orders</s-link>\n  </s-app-nav>\n);\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("ignores plain navigation labels", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'export const nav = (\n  <s-app-nav>\n    <s-link href="/orders">Orders</s-link>\n  </s-app-nav>\n);\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("reports emoji in label attributes", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export const nav = (\n  <s-app-nav>\n    <s-link href="/orders" label="📦 Orders" />\n  </s-app-nav>\n);\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("reports emoji in App Bridge nav menus by default", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export const nav = (\n  <ui-nav-menu>\n    <a href="/orders">📦 Orders</a>\n  </ui-nav-menu>\n);\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("ignores emoji outside navigation", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export const banner = <p>🎉 Sale live</p>;\n", { filename }),
  ).resolves.toBeUndefined();
});
