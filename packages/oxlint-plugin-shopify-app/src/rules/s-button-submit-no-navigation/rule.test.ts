import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/s-button-submit-no-navigation";
const options = { filename: "sample.tsx" };

it.each([
  '<s-button type="submit" href="/products">Save</s-button>',
  '<s-button type="reset" commandFor="dialog">Reset</s-button>',
  '<s-button type={"submit"} command-for="dialog">Save</s-button>',
  '<s-button {...{type: "submit", href: "/products"}}>Save</s-button>',
])("reports ignored form behavior: %s", async (jsx) => {
  await assertRuleReports(rule, `const view = ${jsx};`, options);
});

it.each([
  '<s-button type="submit">Save</s-button>',
  '<s-button type="reset">Reset</s-button>',
  '<s-button type="button" href="/products">Products</s-button>',
  '<s-button type="submit" href="">Save</s-button>',
  '<s-button type="submit" href={target}>Save</s-button>',
  '<s-button type="submit" href="/products" {...props}>Save</s-button>',
  '<button type="submit" href="/products">Save</button>',
])("allows form actions and does not guess dynamic conflicts: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, options);
});
