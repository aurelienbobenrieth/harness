import { expect, it } from "vitest";
import { builtForShopifyExtensions } from "./built-for-shopify-extensions.js";
import { createFixture } from "./test-support.js";

function ui(...targets: string[]): string {
  return (
    '[[extensions]]\ntype = "ui_extension"\n' +
    targets.map((target) => `[[extensions.targeting]]\ntarget = "${target}"`).join("\n")
  );
}

it("does not impose category prerequisites without explicit applicability", async () => {
  const root = await createFixture({});
  expect(await builtForShopifyExtensions.run({ root })).toEqual([]);
  await expect(
    builtForShopifyExtensions.run({ root, builtForShopifyCategories: ["unknown" as "forms"] }),
  ).rejects.toThrow("Unsupported");
});

it("requires both review extension prerequisites and ignores unrelated nested target mentions", async () => {
  const root = await createFixture({
    "extensions/unrelated/shopify.extension.toml":
      '[settings]\ntype = "flow_trigger"\ntarget = "admin.customer-details.block.render"',
  });
  expect(await builtForShopifyExtensions.run({ root, builtForShopifyCategories: ["product-reviews"] })).toHaveLength(2);
});

it("accepts review prerequisites across declared custom extension directories", async () => {
  const root = await createFixture({
    "shopify.app.toml": 'extension_directories = ["features/*"]',
    "features/review-trigger/shopify.extension.toml": '[[extensions]]\ntype = "flow_trigger"',
    "features/customer-reviews/shopify.extension.toml": ui("admin.customer-details.block.render"),
  });
  expect(await builtForShopifyExtensions.run({ root, builtForShopifyCategories: ["product-reviews"] })).toEqual([]);
});

it.each(["advertising", "email-marketing", "forms", "sms-marketing"] as const)(
  "requires the segment action for %s",
  async (category) => {
    const missing = await createFixture({
      "extensions/action/shopify.extension.toml": ui("admin.customer-details.action.render"),
    });
    expect(await builtForShopifyExtensions.run({ root: missing, builtForShopifyCategories: [category] })).toHaveLength(
      1,
    );
    const present = await createFixture({
      "extensions/action/shopify.extension.toml": ui("admin.customer-segment-details.action.render"),
    });
    expect(await builtForShopifyExtensions.run({ root: present, builtForShopifyCategories: [category] })).toEqual([]);
  },
);

it("requires both order print surfaces", async () => {
  const missing = await createFixture({
    "extensions/print/shopify.extension.toml": ui("admin.order-details.print-action.render"),
  });
  expect(await builtForShopifyExtensions.run({ root: missing, builtForShopifyCategories: ["invoices"] })).toHaveLength(
    1,
  );
  const present = await createFixture({
    "extensions/print/shopify.extension.toml": ui(
      "admin.order-details.print-action.render",
      "admin.order-index.selection-print-action.render",
    ),
  });
  expect(await builtForShopifyExtensions.run({ root: present, builtForShopifyCategories: ["invoices"] })).toEqual([]);
});

it("accepts subscriptions only with a customer account surface and product-capable section block", async () => {
  const root = await createFixture({
    "extensions/account/shopify.extension.toml": ui("customer-account.page.render"),
    "extensions/theme/shopify.extension.toml": 'type = "theme"',
    "extensions/theme/blocks/subscription.liquid":
      '{% schema %}{"target":"section","enabled_on":{"templates":["product"]}}{% endschema %}',
  });
  expect(await builtForShopifyExtensions.run({ root, builtForShopifyCategories: ["subscriptions"] })).toEqual([]);
});

it.each([
  '{"target":"body"}',
  '{"target":"section","enabled_on":{"templates":["index"]}}',
  '{"target":"section","disabled_on":{"templates":["product"]}}',
  '{"target":"section","enabled_on":false}',
  '{"target":"section",broken}',
])("rejects subscription blocks that cannot establish a product-section contract", async (schema) => {
  const root = await createFixture({
    "extensions/account/shopify.extension.toml": ui("customer-account.page.render"),
    "extensions/theme/shopify.extension.toml": 'type = "theme"',
    "extensions/theme/blocks/subscription.liquid": `{% schema %}${schema}{% endschema %}`,
  });
  expect(await builtForShopifyExtensions.run({ root, builtForShopifyCategories: ["subscriptions"] })).toHaveLength(1);
});

it.each(["comment", "raw"])("ignores inactive %s schema examples", async (tag) => {
  const root = await createFixture({
    "extensions/account/shopify.extension.toml": ui("customer-account.page.render"),
    "extensions/theme/shopify.extension.toml": 'type = "theme"',
    "extensions/theme/blocks/subscription.liquid": `{% ${tag} %}{% schema %}{"target":"section"}{% endschema %}{% end${tag} %}`,
  });
  expect(await builtForShopifyExtensions.run({ root, builtForShopifyCategories: ["subscriptions"] })).toHaveLength(1);
});

it("reports malformed selected extension manifests instead of treating them as evidence", async () => {
  const root = await createFixture({ "extensions/broken/shopify.extension.toml": "[[broken" });
  const findings = await builtForShopifyExtensions.run({
    root,
    builtForShopifyCategories: ["forms"],
  });
  expect(findings).toHaveLength(2);
  expect(findings.some((finding) => finding.path?.endsWith("shopify.extension.toml"))).toBe(true);
});

it("does not pool extension prerequisites across different deployments", async () => {
  const root = await createFixture({
    "shopify.app.production.toml": 'extension_directories = ["features/live/*"]',
    "shopify.app.local.toml": 'extension_directories = ["features/local/*"]',
    "features/live/trigger/shopify.extension.toml": '[[extensions]]\ntype = "flow_trigger"',
    "features/local/block/shopify.extension.toml": ui("admin.customer-details.block.render"),
  });
  const findings = await builtForShopifyExtensions.run({
    root,
    builtForShopifyCategories: ["product-reviews"],
  });
  expect(findings).toHaveLength(2);
  expect(findings.some((finding) => finding.message.startsWith("shopify.app.production.toml:"))).toBe(true);
  expect(findings.some((finding) => finding.message.startsWith("shopify.app.local.toml:"))).toBe(true);
});

it("requires a Customer Account API prerequisite for returns apps", async () => {
  const missing = await createFixture({ "shopify.app.toml": 'name = "returns"' });
  expect(await builtForShopifyExtensions.run({ root: missing, builtForShopifyCategories: ["returns"] })).toEqual([
    expect.objectContaining({ severity: "error", message: expect.stringMatching(/^Built for Shopify 5\.12\.4: /u) }),
  ]);
  const empty = await createFixture({ "shopify.app.toml": "[customer_authentication]\nredirect_uris = []" });
  expect(await builtForShopifyExtensions.run({ root: empty, builtForShopifyCategories: ["returns"] })).toHaveLength(1);
});

it.each([
  [
    "a customer_authentication client",
    { "shopify.app.toml": '[customer_authentication]\nredirect_uris = ["https://app.example/auth/callback"]' },
  ],
  [
    "a customer account extension",
    { "extensions/returns/shopify.extension.toml": ui("customer-account.order.action.render") },
  ],
])("accepts %s as the returns prerequisite", async (_name, files) => {
  const root = await createFixture(files);
  expect(await builtForShopifyExtensions.run({ root, builtForShopifyCategories: ["returns"] })).toEqual([]);
});

it("reports the subscriptions Customer Account API prerequisite separately", async () => {
  const root = await createFixture({
    "extensions/theme/shopify.extension.toml": 'type = "theme"',
    "extensions/theme/blocks/subscription.liquid": '{% schema %}{"target":"section"}{% endschema %}',
  });
  const findings = await builtForShopifyExtensions.run({ root, builtForShopifyCategories: ["subscriptions"] });
  expect(findings.map((finding) => finding.message.split(":")[0]).toSorted()).toEqual([
    "Built for Shopify 5.14.4",
    "Built for Shopify 5.14.5",
  ]);
});
