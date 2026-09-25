import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/s-form-control-label-required";
const options = { filename: "sample.tsx" };

it.each([
  "text-field",
  "email-field",
  "url-field",
  "password-field",
  "search-field",
  "number-field",
  "money-field",
  "text-area",
  "select",
  "checkbox",
  "switch",
  "choice-list",
  "date-field",
  "color-field",
  "drop-zone",
])("reports unlabeled %s", async (name) => {
  await assertRuleReports(rule, `const view = <s-${name} />;`, options);
});

it.each([
  '<s-text-field placeholder="Your title" />',
  '<s-text-field labelAccessibilityVisibility="exclusive" />',
  "<s-text-field label={null} />",
  "<s-text-field label={false} />",
  '<s-select {...props} label=" " />',
  '<s-text-field {...{label: ""}} />',
  '<s-text-field accessibilityLabel="Unsupported alternative" />',
])("does not accept placeholder or empty label as a name: %s", async (jsx) => {
  await assertRuleReports(rule, `const view = ${jsx};`, options);
});

it.each([
  '<s-text-field label="Title" />',
  '<s-search-field label="Search" labelAccessibilityVisibility="exclusive" />',
  '<s-text-field label={translate("title")} />',
  "<s-text-field {...props} />",
  '<s-text-field label="" {...props} />',
  '<s-text-field {...{label: "Title"}} />',
  '<s-switch accessibilityLabel="Enable suggestions" />',
  '<s-drop-zone accessibility-label="Upload a report" />',
  "<s-color-picker />",
  "<s-date-picker />",
  "<input />",
])("allows supported names and avoids unsupported surfaces: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, options);
});
