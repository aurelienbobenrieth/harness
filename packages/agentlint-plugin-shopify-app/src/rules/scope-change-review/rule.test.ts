import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineScopeChangeReview, scopeChangeReview } from "./rule.js";

const manifest = (scopes: string, extra = ""): string =>
  `client_id = "abc"\n\n[access_scopes]\n# scopes = "write_customers"\nscopes = "${scopes}"\n${extra}\n[webhooks]\napi_version = "2026-07"\n`;

it("reports scopes added to an existing manifest and anchors the scope line", async () => {
  const findings = await testRuleOnChange({
    rule: scopeChangeReview,
    fixture: {
      before: { "shopify.app.toml": manifest("read_products") },
      after: { "shopify.app.toml": manifest("read_products, write_orders,read_all_orders") },
    },
  });
  expect(findings.map((finding) => [finding.file, finding.line, finding.message])).toEqual([
    ["shopify.app.toml", 5, expect.stringContaining("required read_all_orders, write_orders")],
  ]);
});

it("reports every scope of a new deployment manifest, including multi-line optional scopes", async () => {
  const findings = await testRuleOnChange({
    rule: scopeChangeReview,
    fixture: {
      after: {
        "apps/store/shopify.app.production.toml": manifest(
          "read_products",
          'optional_scopes = [\n  "write_products", # editor\n  "read_customers",\n]',
        ),
      },
    },
  });
  expect(findings.map((finding) => finding.message)).toEqual([
    expect.stringContaining("required read_products; optional read_customers, write_products"),
  ]);
});

it("reports an optional scope promoted to required", async () => {
  const findings = await testRuleOnChange({
    rule: scopeChangeReview,
    fixture: {
      before: {
        "shopify.app.toml": manifest("read_products", 'optional_scopes = ["write_products"]'),
      },
      after: { "shopify.app.toml": manifest("read_products,write_products") },
    },
  });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("required write_products")]);
});

it("keeps the same fingerprint when unrelated manifest lines move", async () => {
  const before = { "shopify.app.toml": manifest("read_products") };
  const [first] = await testRuleOnChange({
    rule: scopeChangeReview,
    fixture: {
      before,
      after: { "shopify.app.toml": manifest("read_products,read_orders") },
    },
  });
  const [second] = await testRuleOnChange({
    rule: scopeChangeReview,
    fixture: {
      before,
      after: { "shopify.app.toml": `# note\n${manifest("read_orders,read_products")}` },
    },
  });
  expect(first?.fingerprint).toBeDefined();
  expect(second?.fingerprint).toStrictEqual(first?.fingerprint);
});

it("stays silent when scopes are removed, reordered, demoted to optional, or only commented", async () => {
  const cases = [
    [manifest("read_products,write_orders"), manifest("read_products")],
    [manifest("read_products,write_orders"), manifest("write_orders, read_products")],
    [manifest("read_products,write_orders"), manifest("read_products", 'optional_scopes = ["write_orders"]')],
    [manifest("read_products"), manifest("read_products", '# optional_scopes = ["write_orders"]')],
    [manifest("read_products"), manifest("read_products", 'description = "scopes = write_orders"')],
  ] as const;
  const findings = await Promise.all(
    cases.map(([before, after]) =>
      testRuleOnChange({
        rule: scopeChangeReview,
        fixture: {
          before: { "shopify.app.toml": before },
          after: { "shopify.app.toml": after },
        },
      }),
    ),
  );
  expect(findings).toEqual(cases.map(() => []));
});

it("ignores scope-looking keys outside app manifests and in other tables, and deleted manifests", async () => {
  await expect(
    testRuleOnChange({
      rule: scopeChangeReview,
      fixture: {
        before: { "shopify.app.toml": manifest("read_products") },
        after: {
          "extensions/checkout/shopify.extension.toml": '[access_scopes]\nscopes = "write_orders"\n',
          "shopify.web.toml": 'scopes = "write_orders"\n',
        },
      },
    }),
  ).resolves.toEqual([]);
  await expect(
    testRuleOnChange({
      rule: scopeChangeReview,
      fixture: {
        before: { "shopify.app.toml": "[auth]\n" },
        after: { "shopify.app.toml": '[auth]\nscopes = "write_orders"\n' },
      },
    }),
  ).resolves.toEqual([]);
});

it("honours a custom manifest pattern", async () => {
  const rule = defineScopeChangeReview({ manifestPattern: /(?:^|\/)app\.toml$/g });
  const fixture = { after: { "config/app.toml": 'scopes = "read_orders"\n' } };
  expect(await testRuleOnChange({ rule: rule, fixture: fixture })).toHaveLength(1);
  expect(await testRuleOnChange({ rule: rule, fixture: fixture })).toHaveLength(1);
});
