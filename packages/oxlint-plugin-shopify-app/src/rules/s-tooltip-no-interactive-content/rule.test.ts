import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/s-tooltip-no-interactive-content";
const options = { filename: "sample.tsx" };

it.each([
  "<s-tooltip><s-button>Help</s-button></s-tooltip>",
  '<s-tooltip><s-stack><s-link href="/help">Help</s-link></s-stack></s-tooltip>',
  "<s-tooltip><><button>Help</button></></s-tooltip>",
  '<s-tooltip><a href="/help">Help</a></s-tooltip>',
  "<s-tooltip><input /></s-tooltip>",
  "<s-tooltip><s-color-picker /></s-tooltip>",
  "<s-tooltip><span tabIndex={0}>Details</span></s-tooltip>",
])("reports tooltip controls that cannot be used: %s", async (jsx) => {
  await assertRuleReports(rule, `const view = ${jsx};`, options);
});

it.each([
  "<s-tooltip><s-text>Keyboard shortcut: E</s-text></s-tooltip>",
  '<s-tooltip><input type="hidden" /></s-tooltip>',
  '<s-tooltip><a id="description">Details</a></s-tooltip>',
  "<s-tooltip><Portal><s-button>Elsewhere</s-button></Portal></s-tooltip>",
  "<s-tooltip>{renderDetails()}</s-tooltip>",
  "<s-tooltip>{visible && <s-button>Help</s-button>}</s-tooltip>",
  "<s-popover><s-button>Help</s-button></s-popover>",
])("leaves text, other overlays and unresolved output alone: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, options);
});
