import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/s-clickable-accessible-name";
const options = { filename: "sample.tsx" };

it.each([
  "<s-clickable />",
  '<s-clickable accessibilityLabel="" />',
  '<s-clickable><s-icon type="edit" /></s-clickable>',
  "<s-clickable {...{ accessibilityLabel: null }} />",
])("reports statically unnamed clickables: %s", async (jsx) => {
  await assertRuleReports(rule, `const view = ${jsx};`, options);
});

it.each([
  '<s-clickable accessibilityLabel="Open report"><s-icon type="edit" /></s-clickable>',
  "<s-clickable>Open report</s-clickable>",
  "<s-clickable>{label}</s-clickable>",
  "<s-clickable {...props} />",
  "<CustomClickable />",
])("allows named or runtime-dependent clickables: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, options);
});
