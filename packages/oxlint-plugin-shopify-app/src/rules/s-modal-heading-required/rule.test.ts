import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/s-modal-heading-required";
const filename = "sample.tsx";

it("reports s-modal without heading", async () => {
  await expect(
    assertRuleReports(ruleName, 'export const view = <s-modal id="settings">content</s-modal>;\n', {
      filename,
    }),
  ).resolves.toBeUndefined();
});

it("ignores s-modal with heading", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'export const view = <s-modal heading="Settings">content</s-modal>;\n', {
      filename,
    }),
  ).resolves.toBeUndefined();
});

it("checks configured modal components", async () => {
  await expect(
    assertRuleReports(ruleName, "export const view = <ui-modal>content</ui-modal>;\n", {
      filename,
      ruleOptions: { components: ["ui-modal"] },
    }),
  ).resolves.toBeUndefined();
});

it("ignores unrelated elements", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export const view = <dialog>content</dialog>;\n", {
      filename,
    }),
  ).resolves.toBeUndefined();
});

it('reports regression: const view = <s-modal heading="" />;', async () => {
  await assertRuleReports(ruleName, 'const view = <s-modal heading="" />;', {
    filename: "sample.tsx",
  });
});

it.each([
  '<s-modal heading={""} />',
  "<s-modal heading={null} />",
  "<s-modal heading={false} />",
  "<s-modal heading={void 0} />",
  '<s-modal {...props} heading=" " />',
  '<s-modal heading="Details" {...{heading: ""}} />',
])("reports statically cleared modal headings: %s", async (jsx) => {
  await assertRuleReports(ruleName, `const view = ${jsx};`, { filename });
});

it.each([
  '<s-modal heading={translate("details")} />',
  "<s-modal {...props} />",
  '<s-modal {...{heading: "Details"}} />',
  '<s-modal heading="" {...props} />',
])("respects dynamic headings and effective spread order: %s", async (jsx) => {
  await assertRuleDoesNotReport(ruleName, `const view = ${jsx};`, { filename });
});
