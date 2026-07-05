import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";
import { noRootMargin, noRootMarginRuleName } from "./rule.js";

it("reports outer margins on component roots", async () => {
  await expect(
    assertRuleReports(noRootMargin, noRootMarginRuleName, ".cart-drawer { margin-block-end: 2rem; }"),
  ).resolves.toBeUndefined();
});

it("accepts zero margin resets", async () => {
  await expect(
    assertRuleDoesNotReport(noRootMargin, noRootMarginRuleName, ".cart-drawer { margin: 0; }"),
  ).resolves.toBeUndefined();
});

it("ignores nested selectors", async () => {
  await expect(
    assertRuleDoesNotReport(noRootMargin, noRootMarginRuleName, ".cart-drawer .row { margin-block-end: 1rem; }"),
  ).resolves.toBeUndefined();
});

it("ignores non-margin spacing on roots", async () => {
  await expect(
    assertRuleDoesNotReport(noRootMargin, noRootMarginRuleName, ".cart-drawer { padding: var(--theme-space-2); }"),
  ).resolves.toBeUndefined();
});

it("honours a configured root selector pattern", async () => {
  await expect(
    assertRuleReports(noRootMargin, noRootMarginRuleName, ".c-cart { margin-block-end: 1rem; }", {
      ruleOptions: { rootSelectorPattern: "^\\.c-[\\w-]+$" },
    }),
  ).resolves.toBeUndefined();
});
