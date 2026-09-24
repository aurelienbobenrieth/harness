import { expect, it } from "vitest";
import { flowTemplateContract } from "./flow-template-contract.js";
import { createFixture } from "./test-support.js";

const toml = (template = 'categories = ["orders", "risk"]\nmodule = "./template.flow"', handle = "tag-vip-orders") =>
  `[[extensions]]\nname = "t:name"\ntype = "flow_template"\nhandle = "${handle}"\ndescription = "t:description"\n\n[extensions.template]\n${template}\n`;
const locale = JSON.stringify({ name: "Tag VIP orders when an order is paid", description: "Tags repeat buyers" });
const valid = {
  "extensions/vip/shopify.extension.toml": toml(),
  "extensions/vip/template.flow": "{}",
  "extensions/vip/locales/en.default.json": locale,
};

it("passes a complete template extension", async () => {
  const root = await createFixture({ ...valid, "extensions/vip/locales/fr.json": locale });
  expect(await flowTemplateContract.run({ root })).toEqual([]);
});

it("ignores extensions that are not Flow templates", async () => {
  const root = await createFixture({
    "extensions/trigger/shopify.extension.toml": '[[extensions]]\ntype = "flow_trigger"\nhandle = "bad handle"',
  });
  expect(await flowTemplateContract.run({ root })).toEqual([]);
});

it.each([
  ["an invalid handle", toml(undefined, "vip_orders"), "handle"],
  ["an unknown category", toml('categories = ["orders", "marketing"]\nmodule = "./template.flow"'), '"marketing"'],
  ["no categories", toml('categories = []\nmodule = "./template.flow"'), "template.categories"],
  ["a missing module file", toml('categories = ["orders"]\nmodule = "./missing.flow"'), "does not exist"],
  ["a module outside the extension", toml('categories = ["orders"]\nmodule = "../other/template.flow"'), "inside"],
  ["a non-boolean flag", toml('categories = ["orders"]\nmodule = "./template.flow"\nenabled = "yes"'), "enabled"],
  [
    "no template table",
    '[[extensions]]\nname = "t:name"\ntype = "flow_template"\nhandle = "vip"\ndescription = "t:description"',
    "[extensions.template]",
  ],
])("reports %s", async (_name, manifest, fragment) => {
  const root = await createFixture({ ...valid, "extensions/vip/shopify.extension.toml": manifest });
  expect(await flowTemplateContract.run({ root })).toEqual([
    expect.objectContaining({ severity: "error", message: expect.stringContaining(fragment) }),
  ]);
});

it("warns above the recommended two categories", async () => {
  const root = await createFixture({
    ...valid,
    "extensions/vip/shopify.extension.toml": toml(
      'categories = ["orders", "risk", "loyalty"]\nmodule = "./template.flow"',
    ),
  });
  const findings = await flowTemplateContract.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("warning");
  expect(findings[0]?.message).toContain("recommends at most 2");
});

it("requires exactly one default locale", async () => {
  const root = await createFixture({
    "extensions/vip/shopify.extension.toml": toml(),
    "extensions/vip/template.flow": "{}",
    "extensions/vip/locales/en.json": locale,
  });
  expect(await flowTemplateContract.run({ root })).toEqual([
    expect.objectContaining({ severity: "error", message: expect.stringContaining("0 default locale files") }),
  ]);
});

it("requires an English translation", async () => {
  const root = await createFixture({
    "extensions/vip/shopify.extension.toml": toml(),
    "extensions/vip/template.flow": "{}",
    "extensions/vip/locales/fr.default.json": locale,
  });
  expect(await flowTemplateContract.run({ root })).toEqual([
    expect.objectContaining({ severity: "error", message: expect.stringContaining("English") }),
  ]);
});

it("resolves t: keys: errors in the default locale, warnings elsewhere", async () => {
  const root = await createFixture({
    ...valid,
    "extensions/vip/locales/en.default.json": JSON.stringify({ name: "Tag VIP orders" }),
    "extensions/vip/locales/fr.json": JSON.stringify({ name: "Étiqueter" }),
  });
  const findings = await flowTemplateContract.run({ root });
  expect(findings.map(({ severity, path }) => [severity, path?.replaceAll("\\", "/").split("/").at(-1)])).toEqual([
    ["error", "en.default.json"],
    ["warning", "fr.json"],
  ]);
});

it("enforces the 25 templates per app limit", async () => {
  const files: Record<string, string> = {};
  for (let index = 0; index < 26; index++) {
    files[`extensions/t${index}/shopify.extension.toml`] = toml(undefined, `template-${index}`);
    files[`extensions/t${index}/template.flow`] = "{}";
    files[`extensions/t${index}/locales/en.default.json`] = locale;
  }
  const root = await createFixture(files);
  expect(await flowTemplateContract.run({ root })).toEqual([
    expect.objectContaining({
      severity: "error",
      message: "The app declares 26 Flow templates; Shopify accepts at most 25 per app.",
    }),
  ]);
  delete files["extensions/t25/shopify.extension.toml"];
  expect(await flowTemplateContract.run({ root: await createFixture(files) })).toEqual([]);
});

it("counts the template limit per deployment", async () => {
  const files: Record<string, string> = {
    "shopify.app.production.toml": 'extension_directories = ["live/*"]',
    "shopify.app.staging.toml": 'extension_directories = ["staging/*"]',
  };
  for (let index = 0; index < 26; index++) {
    const directory = index < 13 ? "live" : "staging";
    files[`${directory}/t${index}/shopify.extension.toml`] = toml(undefined, `template-${index}`);
    files[`${directory}/t${index}/template.flow`] = "{}";
    files[`${directory}/t${index}/locales/en.default.json`] = locale;
  }
  expect(await flowTemplateContract.run({ root: await createFixture(files) })).toEqual([]);
});
