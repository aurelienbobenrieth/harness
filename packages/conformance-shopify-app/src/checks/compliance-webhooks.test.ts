import { expect, it } from "vitest";
import { complianceWebhooks } from "./compliance-webhooks.js";
import { runShopifyAppConformanceReport } from "../index.js";
import { createFixture } from "./test-support.js";

const compliantToml = `
[webhooks]
api_version = "2026-04"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://app.example.com/webhooks"
`;

it("passes when all compliance topics are declared in the TOML", async () => {
  const root = await createFixture({ "shopify.app.toml": compliantToml });

  expect(await complianceWebhooks.run({ root })).toEqual([]);
});

it("reports missing compliance topics", async () => {
  const root = await createFixture({
    "shopify.app.toml": `
[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request"]
uri = "https://app.example.com/webhooks"
`,
  });

  const findings = await complianceWebhooks.run({ root });
  expect(findings).toHaveLength(2);
  expect(findings.every((finding) => finding.severity === "error")).toBe(true);
});

it("does not treat source mentions as registered topics", async () => {
  const root = await createFixture({
    "shopify.app.toml": 'name = "app"\n',
    "src/webhooks.ts": 'registerWebhooks(["customers/data_request", "customers/redact", "shop/redact"]);\n',
  });

  expect(await complianceWebhooks.run({ root })).toHaveLength(3);
});

it("warns when no app config exists", async () => {
  const root = await createFixture({ "readme.md": "not a shopify app\n" });

  const findings = await complianceWebhooks.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("warning");
});

it("evaluates only the selected deployment and records it in the report", async () => {
  const root = await createFixture({
    "shopify.app.production.toml": compliantToml,
    "shopify.app.local.toml": 'name = "local"',
  });
  expect(await complianceWebhooks.run({ root, appManifest: "shopify.app.production.toml" })).toEqual([]);
  expect(await complianceWebhooks.run({ root })).toHaveLength(3);
  const report = await runShopifyAppConformanceReport({
    root,
    appManifest: "shopify.app.production.toml",
  });
  expect(report.appManifests).toEqual(["shopify.app.production.toml"]);
  expect(report.findings.filter((finding) => finding.check === "compliance-webhooks")).toEqual([]);
});

it("preserves discovery of CLI-compatible named environment manifests", async () => {
  const root = await createFixture({
    "shopify.app.production-eu.toml": 'name = "missing subscriptions"',
  });
  expect(await complianceWebhooks.run({ root })).toHaveLength(3);
  expect(await complianceWebhooks.run({ root, appManifest: "shopify.app.production-eu.toml" })).toHaveLength(3);
});

it("fails for a missing selected manifest and rejects invalid selectors", async () => {
  const root = await createFixture({ "shopify.app.toml": compliantToml });
  expect(await complianceWebhooks.run({ root, appManifest: "shopify.app.production.toml" })).toEqual([
    expect.objectContaining({ severity: "error", path: "shopify.app.production.toml" }),
  ]);
  await expect(complianceWebhooks.run({ root, appManifest: "../shopify.app.toml" })).rejects.toThrow("appManifest");
  await expect(complianceWebhooks.run({ root, appManifest: "" })).rejects.toThrow("appManifest");
});

it.each([
  '[unrelated]\ncompliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]\nuri = "/hooks"',
  '[[webhooks.subscriptions]]\ncompliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]',
])("does not accept misplaced topics or subscriptions without a delivery URI", async (content) => {
  const root = await createFixture({ "shopify.app.toml": content });
  expect(await complianceWebhooks.run({ root })).toHaveLength(3);
});
