import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/s-button-accessible-name";
const options = { filename: "sample.tsx" };

it.each([
  '<s-button icon="edit" />',
  "<s-button />",
  '<s-button icon="edit" accessibilityLabel="   " />',
  '<s-button icon="edit" accessibilityLabel={null}>{false}</s-button>',
  '<s-button><s-icon type="edit" /></s-button>',
  '<s-button>{/* ignored */}{""}</s-button>',
  '<s-button {...props} accessibilityLabel="" children="" />',
  '<s-button {...{icon: "edit", accessibilityLabel: ""}} />',
])("reports a statically unnamed button: %s", async (jsx) => {
  await assertRuleReports(rule, `const view = ${jsx};`, options);
});

it.each([
  '<s-button icon="edit">Edit product</s-button>',
  '<s-button icon="edit" accessibilityLabel="Edit product" />',
  '<s-button icon="edit" accessibility-label="Edit product" />',
  '<s-button icon="edit" accessibilityLabel={translate("edit")} />',
  "<s-button>{label}</s-button>",
  "<s-button><ActionName /></s-button>",
  '<s-button children="Save" />',
  '<s-button icon="edit" {...props} />',
  '<s-button {...{ accessibilityLabel: "Edit" }} icon="edit" />',
  '<s-button><>{"Save"}</></s-button>',
  "<button />",
])("leaves named or runtime-dependent content to review: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, options);
});
