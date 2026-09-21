import { expect, it } from "vitest";
import { checkoutBundleSize } from "./checkout-bundle-size.js";
import { createFixture } from "./test-support.js";

it("passes for bundles within the 64 KB limit", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml":
      '[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "purchase.checkout.block.render"',
    "extensions/upsell/dist/checkout.js": "a".repeat(10_000),
  });

  expect(await checkoutBundleSize.run({ root })).toEqual([]);
});

it("reports bundles above the 64 KB limit", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml":
      '[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "purchase.checkout.block.render"',
    "extensions/upsell/dist/checkout.js": "a".repeat(70_000),
  });

  const findings = await checkoutBundleSize.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("64 KB");
});

it("honors a stricter configured budget", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml":
      '[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "purchase.checkout.block.render"',
    "extensions/upsell/dist/checkout.js": "a".repeat(40_000),
  });

  const findings = await checkoutBundleSize.run({ root, checkoutBundleLimitKb: 32 });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("32 KB budget");
});

it("reports checkout extensions without built output", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml":
      '[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "purchase.checkout.block.render"',
    "extensions/upsell/src/checkout.tsx": "export default null;\n",
  });

  expect(await checkoutBundleSize.run({ root })).toEqual([expect.objectContaining({ severity: "error" })]);
});

it("checks custom extension directories from the selected deployment", async () => {
  const root = await createFixture({
    "shopify.app.production.toml": 'extension_directories = ["features/*"]',
    "shopify.app.local.toml": 'extension_directories = ["unused/*"]',
    "features/checkout/shopify.extension.toml":
      '[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "purchase.checkout.block.render"',
    "features/checkout/dist/chunks/main.js": "a".repeat(70_000),
  });
  expect(await checkoutBundleSize.run({ root, appManifest: "shopify.app.production.toml" })).toHaveLength(1);
  expect(await checkoutBundleSize.run({ root, appManifest: "shopify.app.local.toml" })).toEqual([]);
});

it.each([
  'type = "theme"\n[settings]\ntarget = "purchase.checkout.block.render"',
  '[[extensions]]\ntype = "function"\n[[extensions.targeting]]\ntarget = "purchase.checkout.block.render"',
  '[[extensions]]\ntype = "ui_extension"\n[extensions.settings]\ntarget = "purchase.checkout.block.render"',
  '[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "customer-account.order-status.block.render"',
])("does not apply checkout budgets to unrelated target mentions: %s", async (toml) => {
  const root = await createFixture({ "extensions/other/shopify.extension.toml": toml });
  expect(await checkoutBundleSize.run({ root })).toEqual([]);
});

it("recognizes real targeting in standalone root UI extension manifests", async () => {
  const root = await createFixture({
    "extensions/checkout/legacy.extension.toml":
      'type = "ui_extension"\n[[targeting]]\ntarget = "purchase.checkout.block.render"',
  });
  expect(await checkoutBundleSize.run({ root })).toEqual([expect.objectContaining({ severity: "error" })]);
});

it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 65])(
  "rejects a budget that disables or weakens the hard limit: %s",
  async (checkoutBundleLimitKb) => {
    const root = await createFixture({});
    await expect(checkoutBundleSize.run({ root, checkoutBundleLimitKb })).rejects.toThrow("checkoutBundleLimitKb");
  },
);
