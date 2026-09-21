import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/s-modal-actions-use-slots";
const filename = "sample.tsx";

it("reports modal buttons without slots", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export const view = (\n  <s-modal heading="Settings">\n    <s-button onClick={save}>Save</s-button>\n  </s-modal>\n);\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("ignores modal buttons in action slots", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'export const view = (\n  <s-modal heading="Settings">\n    <s-button slot="primary-action" onClick={save}>Save</s-button>\n  </s-modal>\n);\n',
      { filename },
    ),
  ).resolves.toBeUndefined();
});

it("ignores buttons outside modals", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export const view = <s-button onClick={save}>Save</s-button>;\n", {
      filename,
    }),
  ).resolves.toBeUndefined();
});

it('reports regression: const view = <s-modal><s-button slot="typo">Save</s-button></s-modal>;', async () => {
  await assertRuleReports(ruleName, 'const view = <s-modal><s-button slot="typo">Save</s-button></s-modal>;', {
    filename: "sample.tsx",
  });
});
