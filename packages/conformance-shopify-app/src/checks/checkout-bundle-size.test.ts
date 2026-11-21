import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { checkoutBundleSize } from "./checkout-bundle-size.js";
import { createFixture } from "./test-support.js";

const checkoutToml =
  '[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "purchase.checkout.block.render"';

/** Bytes that do not compress: chained SHA-256 digests, so the compressed size stays close to the raw size. */
function incompressible(length: number): Buffer {
  const blocks = Array.from({ length: Math.ceil(length / 32) }, (_, index) =>
    createHash("sha256").update(String(index)).digest(),
  );
  return Buffer.concat(blocks).subarray(0, length);
}

it("passes for bundles within the 64 KB compressed limit", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml": checkoutToml,
    "extensions/upsell/dist/checkout.js": incompressible(10_000),
  });

  expect(await checkoutBundleSize.run({ root })).toEqual([]);
});

it("passes a bundle above 64 KB raw that compresses below the limit", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml": checkoutToml,
    "extensions/upsell/dist/checkout.js": 'export const label = "Reserve";\n'.repeat(3_000),
  });

  expect(await checkoutBundleSize.run({ root })).toEqual([]);
});

it("reports bundles above the 64 KB compressed limit", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml": checkoutToml,
    "extensions/upsell/dist/checkout.js": incompressible(70_000),
  });

  expect(await checkoutBundleSize.run({ root })).toEqual([
    expect.objectContaining({
      severity: "error",
      message:
        'Checkout extension "upsell" bundle is 68.4 KB compressed, above the 64 KB budget (Shopify rejects more than 64 KB compressed at deploy). Drop runtime libraries and whole-module imports until it fits.',
    }),
  ]);
});

it("honors a stricter configured budget", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml": checkoutToml,
    "extensions/upsell/dist/checkout.js": incompressible(40_000),
  });

  const findings = await checkoutBundleSize.run({ root, checkoutBundleLimitKb: 32 });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("32 KB budget");
});

it("reports checkout extensions without built output", async () => {
  const root = await createFixture({
    "extensions/upsell/shopify.extension.toml": checkoutToml,
    "extensions/upsell/src/checkout.tsx": "export default null;\n",
  });

  expect(await checkoutBundleSize.run({ root })).toEqual([expect.objectContaining({ severity: "error" })]);
});

it("checks custom extension directories from the selected deployment", async () => {
  const root = await createFixture({
    "shopify.app.production.toml": 'extension_directories = ["features/*"]',
    "shopify.app.local.toml": 'extension_directories = ["unused/*"]',
    "features/checkout/shopify.extension.toml": checkoutToml,
    "features/checkout/dist/chunks/main.js": incompressible(70_000),
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

it.each(["customer-account.page.render", "customer-account.order.page.render"])(
  "applies the 128 KB compressed full-page limit to %s",
  async (target) => {
    const toml = `[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "${target}"`;
    const within = await createFixture({
      "extensions/portal/shopify.extension.toml": toml,
      "extensions/portal/dist/portal.js": incompressible(100_000),
    });
    expect(await checkoutBundleSize.run({ root: within })).toEqual([]);
    const above = await createFixture({
      "extensions/portal/shopify.extension.toml": toml,
      "extensions/portal/dist/portal.js": incompressible(132_000),
    });
    expect(await checkoutBundleSize.run({ root: above })).toEqual([
      expect.objectContaining({
        severity: "error",
        message:
          'Full-page customer account extension "portal" bundle is 128.9 KB compressed, above the 128 KB budget (Shopify rejects more than 128 KB compressed at deploy). Drop runtime libraries and whole-module imports until it fits.',
      }),
    ]);
  },
);

it("keeps the 64 KB checkout limit when an extension also declares a full-page target", async () => {
  const root = await createFixture({
    "extensions/both/shopify.extension.toml":
      '[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "customer-account.page.render"\n[[extensions.targeting]]\ntarget = "purchase.checkout.block.render"',
    "extensions/both/dist/main.js": incompressible(100_000),
  });
  expect(await checkoutBundleSize.run({ root })).toEqual([
    expect.objectContaining({ message: expect.stringContaining("above the 64 KB budget") }),
  ]);
});
