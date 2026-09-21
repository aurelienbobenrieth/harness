import { expect, it } from "vitest";
import { extensionCapabilityContract } from "./extension-capability-contract.js";
import { createFixture } from "./test-support.js";

const manifest = (target: string, capabilities = "", apiVersion = "2026-04"): string =>
  `api_version = "${apiVersion}"\n[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "${target}"\nmodule = "./src/index.tsx"\n${capabilities === "" ? "" : `[extensions.capabilities]\n${capabilities}\n`}`;

const legacy = (capabilities: string): string =>
  `type = "ui_extension"\napi_version = "2026-01"\n${capabilities}\n[[targeting]]\ntarget = "purchase.checkout.block.render"\n`;

it("reports each used capability the checkout manifest does not declare", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml": manifest("purchase.checkout.block.render", "api_access = false"),
    "extensions/upsell/src/index.tsx": `
      const offers = await fetch(\`\${base}/offers\`);
      const { query, cost } = useApi();
      useBuyerJourneyIntercept(() => ({ behavior: "allow" }));
    `,
  });
  const findings = await extensionCapabilityContract.run({ root });
  expect(findings.map((finding) => [finding.severity, finding.message])).toEqual([
    ["error", expect.stringMatching(/mismatch: src\/index\.tsx uses fetch\(\).*network_access = true/u)],
    ["error", expect.stringContaining("api_access = true")],
    ["error", expect.stringContaining("block_progress = true")],
  ]);
  expect(findings.every((finding) => !/will fail|fails at run ?time/iu.test(finding.message))).toBe(true);
});

it("accepts declared capabilities, including customer account targets and shopify.query", async () => {
  const root = await createFixture({
    "extensions/account/shopify.extension.toml": manifest(
      "customer-account.order-status.block.render",
      "network_access = true\napi_access = true",
    ),
    "extensions/account/src/nested/data.ts":
      "export const load = () => Promise.all([globalThis.fetch(url), shopify.query(QUERY)]);",
  });
  expect(await extensionCapabilityContract.run({ root })).toEqual([]);
});

it("stays silent for admin extensions, whose app-domain fetch needs no capability", async () => {
  const root = await createFixture({
    "extensions/admin-block/shopify.extension.toml": manifest("admin.product-details.block.render"),
    "extensions/admin-block/src/index.tsx": 'const response = await fetch("/api/products");',
  });
  expect(await extensionCapabilityContract.run({ root })).toEqual([]);
});

it("ignores comments, strings, methods, local bindings, tests, and sources outside src", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml": manifest("purchase.checkout.block.render"),
    "extensions/upsell/src/index.tsx": `
      // fetch("https://example.test") was removed
      /* shopify.query(QUERY) */
      const label = "Tap to fetch(offers) or useBuyerJourneyIntercept()";
      const cached = client.fetch(key);
      const prefetch = prefetchOffers(settings);
    `,
    "extensions/upsell/src/local.ts": 'import { fetch } from "./stub";\nexport const load = () => fetch("/offers");',
    "extensions/upsell/src/index.test.tsx": 'await fetch("https://example.test");',
    "extensions/upsell/scripts/seed.js": 'await fetch("https://example.test");',
  });
  expect(await extensionCapabilityContract.run({ root })).toEqual([]);
});

it("warns when block_progress is declared at or after the deprecating API version", async () => {
  const files = (version: string) => ({
    "extensions/gate/shopify.extension.toml": manifest(
      "purchase.checkout.block.render",
      "block_progress = true",
      version,
    ),
    "extensions/gate/src/index.tsx": "useBuyerJourneyIntercept(() => ({ behavior: 'allow' }));",
  });
  expect(await extensionCapabilityContract.run({ root: await createFixture(files("2026-07")) })).toEqual([
    expect.objectContaining({
      severity: "warning",
      message: expect.stringContaining("deprecated from 2026-07"),
    }),
  ]);
  expect(await extensionCapabilityContract.run({ root: await createFixture(files("2026-04")) })).toEqual([]);
});

it("supports legacy root extension tables with root capabilities", async () => {
  const source = { "extensions/legacy/src/index.js": "fetch(url);" };
  const declared = await createFixture({
    ...source,
    "extensions/legacy/shopify.extension.toml": legacy("[capabilities]\nnetwork_access = true"),
  });
  expect(await extensionCapabilityContract.run({ root: declared })).toEqual([]);
  const missing = await createFixture({
    ...source,
    "extensions/legacy/shopify.extension.toml": legacy(""),
  });
  expect(await extensionCapabilityContract.run({ root: missing })).toHaveLength(1);
});
