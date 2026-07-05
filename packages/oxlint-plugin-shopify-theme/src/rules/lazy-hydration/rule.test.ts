import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-theme/lazy-hydration";

it("reports static imports of enhancer modules", async () => {
  await expect(
    assertRuleReports(ruleName, 'import "./features/cart-drawer/cart-drawer-enhancer.js";\n', {
      filename: "theme.ts",
    }),
  ).resolves.toBeUndefined();
});

it("reports static named imports from enhancer modules", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { CartDrawer } from "./cart-drawer-enhancer.js";\nconsole.log(CartDrawer);\n', {
      filename: "theme.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores non-enhancer imports", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { machine } from "./cart-drawer-machine.js";\nconsole.log(machine);\n', {
      filename: "theme.ts",
    }),
  ).resolves.toBeUndefined();
});

it("honours a configured enhancer pattern", async () => {
  await expect(
    assertRuleReports(ruleName, 'import "./cart-drawer.island.js";\n', {
      filename: "theme.ts",
      ruleOptions: { enhancerPattern: ".island" },
    }),
  ).resolves.toBeUndefined();
});
