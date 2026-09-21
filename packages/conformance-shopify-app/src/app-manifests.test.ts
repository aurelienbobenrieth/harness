import { expect, it } from "vitest";
import { appManifests } from "./app-manifests.js";
import { createFixture } from "./checks/test-support.js";

it("discovers base and CLI-compatible deployment manifests while ignoring backups", async () => {
  const root = await createFixture({
    "shopify.app.toml": "",
    "shopify.app.production.toml": "",
    "shopify.app.production-eu_2.toml": "",
    "shopify.app.prod.backup.toml": "",
    "shopify.app.prod backup.toml": "",
    "shopify.app..toml": "",
    "shopify.app.production.toml.backup": "",
    "nested/shopify.app.production.toml": "",
  });
  expect(await appManifests({ root })).toEqual([
    "shopify.app.production-eu_2.toml",
    "shopify.app.production.toml",
    "shopify.app.toml",
  ]);
});

it.each(["shopify.app.toml", "shopify.app.production.toml", "shopify.app.production-eu_2.toml"])(
  "retains an explicit valid selector even when its file is missing: %s",
  async (appManifest) => {
    const root = await createFixture({});
    expect(await appManifests({ root, appManifest })).toEqual([appManifest]);
  },
);

it.each([
  "shopify.app.prod.backup.toml",
  "shopify.app.prod backup.toml",
  "shopify.app..toml",
  "shopify.app.production.toml.backup",
  "nested/shopify.app.production.toml",
  "../shopify.app.production.toml",
])("rejects an explicit selector the CLI would not discover: %s", async (appManifest) => {
  const root = await createFixture({});
  await expect(appManifests({ root, appManifest })).rejects.toThrow("appManifest");
});
