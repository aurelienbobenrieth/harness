import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-asset-api-theme-writes";

it("reports themeFilesUpsert mutations", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const mutation = `mutation { themeFilesUpsert(themeId: $id, files: $files) { upsertedThemeFiles { filename } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports themeFilesDelete mutations", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const mutation = `mutation { themeFilesDelete(themeId: $id, files: $files) { deletedThemeFiles { filename } } }`;\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports REST theme asset writes", async () => {
  await expect(
    assertRuleReports(ruleName, 'fetch("/admin/api/2026-04/themes/123/assets.json", { method: "PUT" });\n'),
  ).resolves.toBeUndefined();
});

it("ignores theme reads", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const query = `query { themes(first: 10) { nodes { id } } }`;\n"),
  ).resolves.toBeUndefined();
});

it('accepts regression: fetch("/themes/123/assets.json", {method:"GET"});', async () => {
  await assertRuleDoesNotReport(ruleName, 'fetch("/themes/123/assets.json", {method:"GET"});');
});
