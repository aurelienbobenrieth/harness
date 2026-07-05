import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-theme/feature-boundaries";

it("reports imports into a sibling feature", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { quantityMachine } from "../quantity/quantity-machine.js";\nconsole.log(quantityMachine);\n',
      {
        filename: "frontend/features/cart-drawer/cart-drawer-machine.ts",
      },
    ),
  ).resolves.toBeUndefined();
});

it("allows imports from shared feature modules", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { runtime } from "../runtime/theme-runtime.js";\nconsole.log(runtime);\n',
      {
        filename: "frontend/features/cart-drawer/cart-drawer-machine.ts",
      },
    ),
  ).resolves.toBeUndefined();
});

it("allows imports within the same feature", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { machine } from "./cart-drawer-machine.js";\nconsole.log(machine);\n', {
      filename: "frontend/features/cart-drawer/cart-drawer-enhancer.ts",
    }),
  ).resolves.toBeUndefined();
});

it("ignores files outside the features directory", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { machine } from "../features/quantity/quantity-machine.js";\nconsole.log(machine);\n',
      {
        filename: "frontend/entrypoints/theme.ts",
      },
    ),
  ).resolves.toBeUndefined();
});

it("honours configured shared modules", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { bus } from "../events/bus.js";\nconsole.log(bus);\n', {
      filename: "frontend/features/cart-drawer/cart-drawer-machine.ts",
      ruleOptions: { shared: ["events"] },
    }),
  ).resolves.toBeUndefined();
});
