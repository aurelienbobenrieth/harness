import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/s-money-field-no-currency-symbol";
const options = { filename: "sample.tsx" };

it.each([
  '<s-money-field label="Price ($)" />',
  '<s-money-field label="Prix (€)" />',
  '<s-money-field label="Price" placeholder="¥0" />',
  '<s-money-field {...{ label: "Amount £" }} />',
])("reports locale-independent currency symbols in literal copy: %s", async (jsx) => {
  await assertRuleReports(rule, `const view = ${jsx};`, options);
});

it.each([
  '<s-money-field label="Shipping charge" />',
  '<s-money-field label="Amount in USD" />',
  '<s-money-field label={translate("price")} />',
  '<s-money-field label="Price ($)" {...props} />',
  '<s-number-field label="Amount ($)" />',
])("allows purpose labels and leaves runtime translation to review: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, options);
});
