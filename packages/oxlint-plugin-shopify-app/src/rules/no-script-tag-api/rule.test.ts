import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-script-tag-api";

it("reports scriptTagCreate GraphQL documents", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const mutation = `mutation { scriptTagCreate(input: { src: "https://cdn.example.com/pixel.js" }) { scriptTag { id } } }`;\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports REST script_tags paths", async () => {
  await expect(assertRuleReports(ruleName, 'fetch("/admin/api/2026-04/script_tags.json");\n')).resolves.toBeUndefined();
});

it("reports generated ScriptTagCreate document imports", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { ScriptTagCreateDocument } from "./generated/admin.js";\n'),
  ).resolves.toBeUndefined();
});

it("ignores unrelated GraphQL documents", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const mutation = `mutation { webPixelCreate { webPixel { id } } }`;\n"),
  ).resolves.toBeUndefined();
});

it("states the shutdown date and changelog reference", async () => {
  const { noScriptTagApi } = await import("./rule.js");
  const message = noScriptTagApi.meta?.messages?.["noScriptTagApi"];
  expect(message).toContain("2027-03-01");
  expect(message).toContain("shopify.dev/changelog/online-store-script-tags-deprecation");
});
