import { expect, it } from "vitest";
import { functionsLocalization } from "./functions-localization.js";
import { createFixture } from "./test-support.js";

const localizedToml = '[[extensions]]\nname = "t:name"\ndescription = "t:description"\ntype = "function"\n';

it("passes when the locales contract is complete", async () => {
  const root = await createFixture({
    "extensions/volume-discount/shopify.extension.toml": localizedToml,
    "extensions/volume-discount/locales/en.default.json": '{ "name": "Volume discount", "description": "Tiers" }',
    "extensions/volume-discount/locales/fr.json": '{ "name": "Remise", "description": "Paliers" }',
  });

  expect(await functionsLocalization.run({ root })).toEqual([]);
});

it("reports a missing default locale file", async () => {
  const root = await createFixture({
    "extensions/volume-discount/shopify.extension.toml": localizedToml,
    "extensions/volume-discount/locales/en.json": '{ "name": "Volume discount", "description": "Tiers" }',
  });

  const findings = await functionsLocalization.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("error");
});

it("reports missing keys with severity by locale kind", async () => {
  const root = await createFixture({
    "extensions/volume-discount/shopify.extension.toml": localizedToml,
    "extensions/volume-discount/locales/en.default.json": '{ "name": "Volume discount" }',
    "extensions/volume-discount/locales/fr.json": '{ "name": "Remise" }',
  });

  const findings = await functionsLocalization.run({ root });
  expect(findings).toHaveLength(2);
  expect(findings.map((finding) => finding.severity).toSorted()).toEqual(["error", "warning"]);
});

it("ignores extensions without translation keys", async () => {
  const root = await createFixture({
    "extensions/plain/shopify.extension.toml": '[[extensions]]\nname = "Plain"\ntype = "function"\n',
  });

  expect(await functionsLocalization.run({ root })).toEqual([]);
});

it.each([
  '[[extensions]]\nname = "t:name"\ntype = "ui_extension"',
  'type = "theme"\n[settings]\nname = "t:name"',
  '[[extensions]]\ntype = "function"\n[extensions.settings]\nname = "t:not-a-function-name"',
])("does not interpret unrelated surfaces or nested metadata as function translations: %s", async (toml) => {
  const root = await createFixture({ "extensions/other/shopify.extension.toml": toml });
  expect(await functionsLocalization.run({ root })).toEqual([]);
});

it("checks inherited function descriptions and standalone root function names", async () => {
  const root = await createFixture({
    "extensions/first/shopify.extension.toml": 'description = "t:description"\n[[extensions]]\ntype = "function"',
    "extensions/second/legacy.extension.toml": 'type = "function"\nname = "t:name"',
  });
  expect(await functionsLocalization.run({ root })).toHaveLength(2);
});

it("does not require an overridden function description translation", async () => {
  const root = await createFixture({
    "extensions/function/shopify.extension.toml":
      'description = "t:unused"\n[[extensions]]\ntype = "function"\ndescription = "Visible description"',
  });
  expect(await functionsLocalization.run({ root })).toEqual([]);
});
