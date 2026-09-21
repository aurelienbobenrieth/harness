import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-stale-api-version-in-source";
const ruleOptions = { minimumApiVersion: "2025-10", maximumApiVersion: "2026-07" };

it.each([
  ["a REST-style URL", "fetch(`https://${shop}/admin/api/2023-10/graphql.json`);\n"],
  ["an admin extension protocol URL", 'fetch("shopify:admin/api/2024-01/graphql.json");\n'],
  ["a Storefront URL", 'const url = "/api/2025-07/graphql.json";\n'],
  ["an ApiVersion member", "const app = shopifyApp({ apiVersion: ApiVersion.October23 });\n"],
  ["an apiVersion string", 'const app = shopifyApp({ apiVersion: "2025-01" });\n'],
  ["a version above the reviewed maximum", "const app = shopifyApp({ apiVersion: ApiVersion.October26 });\n"],
])("reports %s outside the configured bounds", async (_label, code) => {
  await expect(assertRuleReports(ruleName, code, { ruleOptions })).resolves.toBeUndefined();
});

it("reports unstable without options", async () => {
  await expect(
    assertRuleReports(ruleName, "const app = shopifyApp({ apiVersion: ApiVersion.Unstable });\n"),
  ).resolves.toBeUndefined();
  await expect(assertRuleReports(ruleName, 'fetch("/admin/api/unstable/graphql.json");\n')).resolves.toBeUndefined();
});

it("accepts versions inside the bounds and near misses", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "fetch(`https://${shop}/admin/api/2026-04/graphql.json`);",
        "const app = shopifyApp({ apiVersion: ApiVersion.January26 });",
        'const released = "2023-10";',
        'const report = { period: "2023-10", apiVersion: version };',
        'const docs = "/docs/api/2023-13/reference";',
        "const other = Versions.October23;",
        "",
      ].join("\n"),
      { ruleOptions },
    ),
  ).resolves.toBeUndefined();
});

it("reports nothing clock-derived without options and allows unstable in tests", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'fetch("/admin/api/2019-04/graphql.json");\n'),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, 'fetch("/admin/api/unstable/graphql.json");\n', {
      filename: "app/__tests__/client.ts",
    }),
  ).resolves.toBeUndefined();
});
