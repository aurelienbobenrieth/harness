import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/s-action-slot-contract";
const options = { filename: "sample.tsx" };

it.each([
  '<s-page><s-button slot="primary-action">Save</s-button></s-page>',
  '<s-modal><s-button slot="primary-action" variant="secondary">Save</s-button></s-modal>',
  '<s-page><s-link slot="primary-action">Save</s-link></s-page>',
  '<s-page><s-button slot="primary-action" variant="primary" /><s-button slot="primary-action" variant="primary" /></s-page>',
  '<s-modal><><s-button slot="primary-action" variant="primary" /><s-button slot="primary-action" variant="primary" /></></s-modal>',
  '<s-modal><s-button-group slot="secondary-actions" /></s-modal>',
  '<s-page><s-button slot="secondary-actions" variant="primary" /></s-page>',
  '<s-page><s-button {...{slot: "primary-action", variant: "secondary"}} /></s-page>',
])("reports invalid native slot contracts: %s", async (jsx) => {
  await assertRuleReports(rule, `const view = ${jsx};`, options);
});

it.each([
  '<s-page><s-button slot="primary-action" variant="primary">Save</s-button><s-button slot="secondary-actions">Cancel</s-button><s-link slot="breadcrumb-actions" href="/">Home</s-link></s-page>',
  '<s-modal><s-button slot="primary-action" variant="primary" /><s-button slot="secondary-actions" variant="secondary" /></s-modal>',
  '<s-page><s-button-group slot="secondary-actions" /></s-page>',
  '<s-page><s-section><s-button slot="primary-action" /></s-section></s-page>',
  '<s-page><s-button slot="primary-action" variant={variant} /></s-page>',
  '<s-page>{active ? <s-button slot="primary-action" variant="primary" /> : <s-button slot="primary-action" variant="primary" />}</s-page>',
  '<s-page><Action slot="primary-action" /></s-page>',
  '<s-page><s-button slot="breadcrumb-actions" /></s-page>',
  "<s-page><s-button {...props} /></s-page>",
  '<dialog><button slot="primary-action" /></dialog>',
])("allows supported slots and leaves component/conditional output to review: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, options);
});
