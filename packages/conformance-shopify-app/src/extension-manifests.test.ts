import { expect, it } from "vitest";
import path from "node:path";
import { readExtensionManifests } from "./extension-manifests.js";
import { createFixture } from "./checks/test-support.js";

const check = "discovery-test";
const docs = "https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration";

it("defaults to immediate extension directories and recognizes alternate manifest basenames", async () => {
  const root = await createFixture({
    "extensions/live/shopify.extension.toml": 'type = "theme"',
    "extensions/other/custom.extension.toml": 'type = "theme"',
    "extensions/live/fixtures/sample/shopify.extension.toml": 'type = "theme"',
    "extensions/not-an-extension.toml": 'type = "theme"',
  });
  const result = await readExtensionManifests({ root }, check, docs);
  expect(result.findings).toEqual([]);
  expect(result.manifests.map((entry) => path.relative(root, entry.path).replaceAll("\\", "/"))).toEqual([
    "extensions/live/shopify.extension.toml",
    "extensions/other/custom.extension.toml",
  ]);
});

it("uses a literal custom directory exactly without including its nested examples", async () => {
  const root = await createFixture({
    "shopify.app.toml": 'extension_directories = ["features/live"]',
    "features/live/main.extension.toml": 'type = "theme"',
    "features/live/nested/shopify.extension.toml": 'type = "theme"',
  });
  const result = await readExtensionManifests({ root }, check, docs);
  expect(result.manifests.map((entry) => path.basename(entry.path))).toEqual(["main.extension.toml"]);
});

it.each(["features/*", "features/**"])("preserves the requested depth for custom glob %s", async (pattern) => {
  const root = await createFixture({
    "shopify.app.toml": `extension_directories = ["${pattern}"]`,
    "features/live/shopify.extension.toml": 'type = "theme"',
    "features/live/nested/shopify.extension.toml": 'type = "theme"',
  });
  const result = await readExtensionManifests({ root }, check, docs);
  expect(result.manifests).toHaveLength(pattern === "features/*" ? 1 : 2);
});

it("uses the CLI fallback for an explicitly empty extension directory list", async () => {
  const root = await createFixture({
    "shopify.app.toml": "extension_directories = []",
    "extensions/live/shopify.extension.toml": 'type = "theme"',
  });
  const result = await readExtensionManifests({ root }, check, docs);
  expect(result.manifests).toHaveLength(1);
});

it("honors an explicitly selected output-named directory but excludes dependency manifests", async () => {
  const root = await createFixture({
    "shopify.app.toml": 'extension_directories = ["features/**"]',
    "features/dist/shopify.extension.toml": 'type = "theme"',
    "features/node_modules/dependency/shopify.extension.toml": 'type = "theme"',
  });
  const result = await readExtensionManifests({ root }, check, docs);
  expect(result.manifests.map((entry) => path.relative(root, entry.path).replaceAll("\\", "/"))).toEqual([
    "features/dist/shopify.extension.toml",
  ]);
});
