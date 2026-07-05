import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "lit/template-no-positive-tabindex";

it("reports positive tabindex", async () => {
  await expect(
    assertRuleReports(ruleName, 'const view = html`<div tabindex="3">Buy</div>`;\n'),
  ).resolves.toBeUndefined();
});

it("ignores tabindex zero and minus one", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const view = html`<div tabindex="0"></div><div tabindex="-1"></div>`;\n'),
  ).resolves.toBeUndefined();
});
