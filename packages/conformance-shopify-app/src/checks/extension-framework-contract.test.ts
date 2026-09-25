import { expect, it } from "vitest";
import { extensionFrameworkContract } from "./extension-framework-contract.js";
import { createFixture } from "./test-support.js";

const manifest = (version: string) =>
  `api_version = "${version}"\n[[extensions]]\ntype = "ui_extension"\n[[extensions.targeting]]\ntarget = "purchase.checkout.block.render"`;
const reactPackage = JSON.stringify({ dependencies: { "@shopify/ui-extensions-react": "2025.7.x", react: "^18.0.0" } });
const reactSource = "import {reactExtension, Text} from '@shopify/ui-extensions-react/checkout';\n";

it.each(["2025-10", "2026-07", "unstable"])("reports the React package at api_version %s", async (version) => {
  const root = await createFixture({
    "extensions/offer/shopify.extension.toml": manifest(version),
    "extensions/offer/package.json": reactPackage,
    "extensions/offer/src/Checkout.tsx": reactSource,
  });
  const findings = await extensionFrameworkContract.run({ root });
  expect(findings.map(({ severity, path }) => [severity, path?.replaceAll("\\", "/").split("/").at(-1)])).toEqual([
    ["error", "package.json"],
    ["error", "Checkout.tsx"],
  ]);
  expect(findings[0]?.message).toContain(`api_version ${version}`);
});

it.each(["2025-07", "2024-10"])("allows the React package before 2025-10 (%s)", async (version) => {
  const root = await createFixture({
    "extensions/offer/shopify.extension.toml": manifest(version),
    "extensions/offer/package.json": reactPackage,
    "extensions/offer/src/Checkout.tsx": reactSource,
  });
  expect(await extensionFrameworkContract.run({ root })).toEqual([]);
});

it("accepts Preact extensions on current versions", async () => {
  const root = await createFixture({
    "extensions/offer/shopify.extension.toml": manifest("2026-07"),
    "extensions/offer/package.json": JSON.stringify({
      dependencies: { "@shopify/ui-extensions": "2026.7.x", preact: "^10.10.0" },
    }),
    "extensions/offer/src/Checkout.tsx":
      "import '@shopify/ui-extensions/preact';\nimport {render} from 'preact';\n// was: '@shopify/ui-extensions-react/checkout'\n",
  });
  expect(await extensionFrameworkContract.run({ root })).toEqual([]);
});

it("applies a per-extension api_version over the file default", async () => {
  const root = await createFixture({
    "extensions/offer/shopify.extension.toml":
      'api_version = "2025-07"\n[[extensions]]\ntype = "ui_extension"\napi_version = "2025-10"',
    "extensions/offer/src/index.jsx": 'const ui = require("@shopify/ui-extensions-react/customer-account");\n',
  });
  expect(await extensionFrameworkContract.run({ root })).toEqual([
    expect.objectContaining({ severity: "error", path: expect.stringContaining("index.jsx") }),
  ]);
});

it("ignores non-UI extensions", async () => {
  const root = await createFixture({
    "extensions/fn/shopify.extension.toml": 'api_version = "2026-07"\n[[extensions]]\ntype = "function"',
    "extensions/fn/package.json": reactPackage,
  });
  expect(await extensionFrameworkContract.run({ root })).toEqual([]);
});
