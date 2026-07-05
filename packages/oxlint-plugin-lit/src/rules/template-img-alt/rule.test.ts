import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "lit/template-img-alt";

it("reports img without alt in html templates", async () => {
  await expect(
    assertRuleReports(ruleName, 'const view = html`<img src="${product.image}">`;\n'),
  ).resolves.toBeUndefined();
});

it("ignores img with static alt", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const view = html`<img src="cart.png" alt="Cart contents">`;\n'),
  ).resolves.toBeUndefined();
});

it("ignores img with bound alt", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const view = html`<img src=${src} alt=${altText}>`;\n"),
  ).resolves.toBeUndefined();
});

it("ignores img with empty decorative alt", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const view = html`<img src="divider.svg" alt="">`;\n'),
  ).resolves.toBeUndefined();
});

it("ignores non-lit template literals", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const raw = `<img src='x.png'>`;\n")).resolves.toBeUndefined();
});
