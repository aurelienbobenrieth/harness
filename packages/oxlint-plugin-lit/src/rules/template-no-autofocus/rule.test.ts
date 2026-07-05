import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "lit/template-no-autofocus";

it("reports autofocus attributes", async () => {
  await expect(
    assertRuleReports(ruleName, 'const view = html`<input type="search" autofocus>`;\n'),
  ).resolves.toBeUndefined();
});

it("ignores templates without autofocus", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const view = html`<input type="search">`;\n'),
  ).resolves.toBeUndefined();
});

it("ignores autofocus-like words in text content", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const view = html`<p>The autofocus attribute is disabled here.</p>`;\n"),
  ).resolves.toBeUndefined();
});
