import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const rule = "shopify-app/no-admin-rest-api";

it.each([
  'import { restResources } from "@shopify/shopify-api/rest/admin/2026-07";',
  'import "@shopify/shopify-api/rest/admin/2026-07";',
  'import("@shopify/shopify-api/rest/admin/2026-07");',
  'const resources = require("@shopify/shopify-api/rest/admin/2026-07");',
  'fetch("https://merchant.myshopify.com/admin/api/2026-07/products.json");',
  'fetch("/admin/api/unstable/products/123.json?fields=id");',
  'globalThis.fetch("/admin/api/2026-07/products.json");',
  'window["fetch"]("/admin/api/2026-07/products.json");',
  "fetch(`https://${shop}.myshopify.com/admin/api/2026-07/products/${id}.json`);",
])("reports recognizable REST dependencies and requests: %s", async (code) => {
  await assertRuleReports(rule, code);
});

it.each([
  'import type { Product } from "@shopify/shopify-api/rest/admin/2026-07";',
  'import { type Product } from "@shopify/shopify-api/rest/admin/2026-07";',
  'import { shopifyApi } from "@shopify/shopify-api";',
  'fetch("https://merchant.myshopify.com/admin/api/2026-07/graphql.json");',
  'fetch("/api/2026-07/graphql.json");',
  'fetch("/cart/add.js");',
  'fetch("https://example.com/admin/api/2026-07/products.json");',
  'fetch("https://merchant.myshopify.com.attacker.test/admin/api/2026-07/products.json");',
  'const reference = "/admin/api/2026-07/products.json"; console.log(reference);',
  'function read(fetch) { fetch("/admin/api/2026-07/products.json"); }',
  'function read(window) { window.fetch("/admin/api/2026-07/products.json"); }',
  'const read = (require) => require("@shopify/shopify-api/rest/admin/2026-07");',
  "fetch(`/admin/api/2026-07/${endpoint}.json`);",
  "fetch(endpoint);",
  'fetch("/admin/api/2026-07/products");',
])("avoids GraphQL, storefront, unrelated or unresolved APIs: %s", async (code) => {
  await assertRuleDoesNotReport(rule, code);
});
