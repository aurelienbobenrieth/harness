import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/s-spinner-accessible-label";
const options = { filename: "sample.tsx" };

it.each([
  "<s-spinner />",
  '<s-spinner accessibilityLabel="" />',
  "<s-spinner accessibilityLabel={false} />",
  "<s-spinner accessibilityLabel={null} />",
  "<s-spinner accessibilityLabel={void 0} />",
  "<s-spinner accessibilityLabel />",
  '<s-spinner accessibil-ity-label="Loading" />',
  '<s-spinner {...{ "accessibil-ity-label": "Loading" }} />',
  '<s-spinner {...props} accessibilityLabel={" " as const} />',
  '<s-spinner accessibilityLabel="Loading" {...{ accessibilityLabel: "" }} />',
])("reports missing or known empty spinner names: %s", async (jsx) => {
  await assertRuleReports(rule, `const view = ${jsx};`, options);
});

it.each([
  '<s-spinner accessibilityLabel="Loading report" />',
  '<s-spinner accessibility-label="Loading report" />',
  '<s-spinner accessibilitylabel="Loading report" />',
  '<s-spinner accessibilityLabel={translate("loading")} />',
  "<s-spinner accessibilityLabel={`Loading report`} />",
  "<s-spinner {...props} />",
  '<s-spinner {...{ accessibilityLabel: "Loading" }} />',
  "<Spinner />",
])("allows known names and unresolved runtime props: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, options);
});
