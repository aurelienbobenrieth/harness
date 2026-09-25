import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/s-page-aside-visible";
const options = { filename: "sample.tsx" };

it.each([
  '<s-page inlineSize="large"><s-section slot="aside" /></s-page>',
  '<s-page inline-size="small"><><s-section slot={"aside"} /></></s-page>',
  '<s-page {...{inlineSize: "large"}}><s-section slot="aside" /></s-page>',
])("reports aside content that cannot render: %s", async (jsx) => {
  await assertRuleReports(rule, `const view = ${jsx};`, options);
});

it.each([
  '<s-page><s-section slot="aside" /></s-page>',
  '<s-page inlineSize="base"><s-section slot="aside" /></s-page>',
  '<s-page inlineSize={width}><s-section slot="aside" /></s-page>',
  '<s-page inlineSize="large" {...props}><s-section slot="aside" /></s-page>',
  '<s-page inlineSize="large"><s-section /></s-page>',
  '<s-modal inlineSize="large"><s-section slot="aside" /></s-modal>',
])("allows visible or unresolved aside layouts: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, options);
});
