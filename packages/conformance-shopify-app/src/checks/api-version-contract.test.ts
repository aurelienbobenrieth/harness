import { expect, it } from "vitest";
import { apiVersionContract } from "./api-version-contract.js";
import { createFixture } from "./test-support.js";

it("validates selected webhook and custom-directory extension versions against explicit bounds", async () => {
  const root = await createFixture({
    "shopify.app.production.toml": 'extension_directories = ["features/*"]\n[webhooks]\napi_version = "2026-07"',
    "shopify.app.local.toml": '[webhooks]\napi_version = "2020-01"',
    "features/checkout/shopify.extension.toml": 'api_version = "2026-07"\n[[extensions]]\ntype = "ui_extension"',
  });
  expect(
    await apiVersionContract.run({
      root,
      appManifest: "shopify.app.production.toml",
      minimumApiVersion: "2025-10",
      maximumApiVersion: "2026-07",
    }),
  ).toEqual([]);
  expect(
    await apiVersionContract.run({
      root,
      appManifest: "shopify.app.production.toml",
      maximumApiVersion: "2026-04",
    }),
  ).toEqual([
    expect.objectContaining({ severity: "error", path: "shopify.app.production.toml" }),
    expect.objectContaining({ severity: "error", path: expect.stringContaining("checkout") }),
  ]);
});
it("reports an extension whose API version drifts from the app's webhook version", async () => {
  const root = await createFixture({
    "shopify.app.toml": '[webhooks]\napi_version = "2026-10"',
    "extensions/checkout/shopify.extension.toml": 'api_version = "2026-07"\n[[extensions]]\ntype = "ui_extension"',
  });
  expect(await apiVersionContract.run({ root })).toEqual([
    {
      check: "api-version-contract",
      docs: expect.any(String),
      path: expect.stringContaining("checkout"),
      severity: "error",
      message: expect.stringMatching(
        /extensions\[0\]\.api_version: The extension uses API version 2026-07 while shopify\.app\.toml declares 2026-10/u,
      ),
    },
  ]);
});
it("accepts extensions on the app's webhook version", async () => {
  const root = await createFixture({
    "shopify.app.toml": '[webhooks]\napi_version = "2026-10"',
    "extensions/checkout/shopify.extension.toml": 'api_version = "2026-10"\n[[extensions]]\ntype = "ui_extension"',
    "extensions/theme/shopify.extension.toml": 'type = "theme"',
  });
  expect(await apiVersionContract.run({ root })).toEqual([]);
});

const adminApp = (client: string) => ({
  "shopify.app.toml": '[webhooks]\napi_version = "2026-10"',
  "src/admin-api.ts": client,
});
it("leaves Admin API paths unscanned unless adminApiPaths is set", async () => {
  const root = await createFixture(adminApp("fetch(`https://${shop}/admin/api/2025-01/graphql.json`);"));
  expect(await apiVersionContract.run({ root })).toEqual([]);
});

it("accepts Admin API paths that name the app's version", async () => {
  const root = await createFixture(adminApp("fetch(`https://${shop}/admin/api/2026-10/graphql.json`);"));
  expect(await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/**/*.ts"] } })).toEqual([]);
});
it("reports an Admin API path on another version than the app's", async () => {
  const root = await createFixture(adminApp("fetch(`https://${shop}/admin/api/2025-01/graphql.json`);"));
  expect(await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/**/*.ts"] } })).toEqual([
    expect.objectContaining({
      severity: "error",
      path: "src/admin-api.ts",
      message: expect.stringMatching(/^\/admin\/api\/2025-01\/: .* declares 2026-10 .* Write 2026-10 /u),
    }),
  ]);
});
it("accepts Admin API paths written through a constant that holds the app's version", async () => {
  const root = await createFixture(
    adminApp(
      'export const adminApiVersion = "2026-10";\nfetch(`https://${shop}/admin/api/${adminApiVersion}/graphql.json`);',
    ),
  );
  expect(
    await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/**/*.ts"], constant: "adminApiVersion" } }),
  ).toEqual([]);
});
it("reports a version constant that drifts from the app's version", async () => {
  const root = await createFixture(
    adminApp(
      'export const adminApiVersion = "2026-07";\nfetch(`https://${shop}/admin/api/${adminApiVersion}/graphql.json`);',
    ),
  );
  expect(
    await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/**/*.ts"], constant: "adminApiVersion" } }),
  ).toEqual([
    expect.objectContaining({
      severity: "error",
      path: "src/admin-api.ts",
      message: expect.stringContaining(
        "adminApiVersion: The constant holds 2026-07 while shopify.app.toml declares 2026-10",
      ),
    }),
  ]);
});
it("reports a literal Admin API path that bypasses the version constant", async () => {
  const root = await createFixture(
    adminApp('export const adminApiVersion = "2026-10";\nfetch(`https://${shop}/admin/api/2026-07/graphql.json`);'),
  );
  expect(
    await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/**/*.ts"], constant: "adminApiVersion" } }),
  ).toEqual([expect.objectContaining({ message: expect.stringContaining("Write ${adminApiVersion} ") })]);
});
it("reports a version constant that the selected sources never declare", async () => {
  const root = await createFixture(adminApp("fetch(`https://${shop}/admin/api/${adminApiVersion}/graphql.json`);"));
  expect(
    await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/**/*.ts"], constant: "adminApiVersion" } }),
  ).toEqual([expect.objectContaining({ message: expect.stringContaining("has no literal API version declaration") })]);
});
it("skips test files when scanning Admin API paths", async () => {
  const root = await createFixture({
    ...adminApp("fetch(`https://${shop}/admin/api/2026-10/graphql.json`);"),
    "src/admin-api.test.ts": "fetch(`https://${shop}/admin/api/2020-01/graphql.json`);",
  });
  expect(await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/**/*.ts"] } })).toEqual([]);
});

it("reports Admin API sources that hold no Admin API path", async () => {
  const root = await createFixture(adminApp('fetch("/graphql");'));
  expect(await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/**/*.ts"] } })).toEqual([
    expect.objectContaining({ message: expect.stringContaining("contain no /admin/api/<version>/ path") }),
  ]);
});

it("reports an Admin API source pattern that matches no file", async () => {
  const root = await createFixture(adminApp("fetch(`https://${shop}/admin/api/2026-10/graphql.json`);"));
  expect(
    await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/admin-api.ts", "lib/missing.ts"] } }),
  ).toEqual([expect.objectContaining({ severity: "error", path: "lib/missing.ts" })]);
});
it("reports Admin API paths when no app manifest declares a webhook version", async () => {
  const root = await createFixture({ "src/admin-api.ts": 'fetch("/admin/api/2026-10/graphql.json");' });
  expect(await apiVersionContract.run({ root, adminApiPaths: { sources: ["src/**/*.ts"] } })).toEqual([
    expect.objectContaining({ message: expect.stringContaining("No selected app manifest declares") }),
  ]);
});

it("rejects empty Admin API sources and a constant that is no identifier", async () => {
  const root = await createFixture(adminApp(""));
  await expect(apiVersionContract.run({ root, adminApiPaths: { sources: [] } })).rejects.toThrow("sources");
  await expect(
    apiVersionContract.run({ root, adminApiPaths: { sources: ["src/admin-api.ts"], constant: "admin-version" } }),
  ).rejects.toThrow("constant");
});
it.each(["2026-02", "latest", "2026-7", "", "2026-04-extra"])(
  "rejects malformed quarterly API version %s",
  async (version) => {
    const root = await createFixture({
      "shopify.app.toml": `[webhooks]\napi_version = ${JSON.stringify(version)}`,
    });
    expect(await apiVersionContract.run({ root })).toHaveLength(1);
  },
);
it("keeps unstable advisory unless the caller configures a stable deployment range", async () => {
  const root = await createFixture({ "shopify.app.toml": '[webhooks]\napi_version = "unstable"' });
  expect(await apiVersionContract.run({ root })).toEqual([expect.objectContaining({ severity: "warning" })]);
  expect(await apiVersionContract.run({ root, minimumApiVersion: "2025-10" })).toEqual([
    expect.objectContaining({ severity: "error" }),
  ]);
});

it("does not invent a support deadline or an API version for unversioned theme extensions", async () => {
  const root = await createFixture({
    "shopify.app.toml": '[webhooks]\napi_version = "2020-01"',
    "extensions/theme/shopify.extension.toml": 'type = "theme"',
  });
  expect(await apiVersionContract.run({ root })).toEqual([]);
  expect(await apiVersionContract.run({ root, minimumApiVersion: "2025-10" })).toHaveLength(1);
});
it("rejects missing versioned extension versions and invalid caller bounds", async () => {
  const root = await createFixture({
    "extensions/function/shopify.extension.toml": '[[extensions]]\ntype = "function"',
  });
  expect(await apiVersionContract.run({ root })).toHaveLength(1);
  await expect(apiVersionContract.run({ root, minimumApiVersion: "2026-02" })).rejects.toThrow("bounds");
  await expect(
    apiVersionContract.run({ root, minimumApiVersion: "2026-07", maximumApiVersion: "2026-04" }),
  ).rejects.toThrow("bounds");
});

it.each([
  'extension_directories = "features"',
  'extension_directories = ["../features"]',
  'extension_directories = ["/features"]',
])("does not silently accept invalid extension discovery", async (manifest) => {
  const root = await createFixture({ "shopify.app.toml": manifest });
  expect(await apiVersionContract.run({ root })).toEqual([expect.objectContaining({ severity: "error" })]);
});

it("checks per-extension API version overrides instead of accepting a current root version", async () => {
  const root = await createFixture({
    "extensions/function/shopify.extension.toml":
      'api_version = "2026-07"\n[[extensions]]\ntype = "function"\napi_version = "2020-01"',
  });
  const findings = await apiVersionContract.run({ root, minimumApiVersion: "2025-10" });
  expect(findings).toEqual([
    expect.objectContaining({
      severity: "error",
      message: expect.stringContaining("extensions[0].api_version"),
    }),
  ]);
});

it("accepts independent entry versions without an inherited root version", async () => {
  const root = await createFixture({
    "extensions/mixed/shopify.extension.toml":
      '[[extensions]]\ntype = "function"\napi_version = "2026-04"\n[[extensions]]\ntype = "ui_extension"\napi_version = "2026-07"',
  });
  expect(
    await apiVersionContract.run({
      root,
      minimumApiVersion: "2025-10",
      maximumApiVersion: "2026-07",
    }),
  ).toEqual([]);
});

it("requires inherited versions only for entries that do not override them", async () => {
  const root = await createFixture({
    "extensions/mixed/shopify.extension.toml":
      '[[extensions]]\ntype = "function"\napi_version = "2026-07"\n[[extensions]]\ntype = "ui_extension"',
  });
  const findings = await apiVersionContract.run({ root });
  expect(findings).toEqual([
    expect.objectContaining({
      severity: "error",
      message: expect.stringContaining("extensions[1].api_version"),
    }),
  ]);
});

it("rejects malformed overrides even when the inherited root version is valid", async () => {
  const root = await createFixture({
    "extensions/function/custom.extension.toml":
      'api_version = "2026-07"\n[[extensions]]\ntype = "function"\napi_version = false',
  });
  expect(await apiVersionContract.run({ root })).toEqual([expect.objectContaining({ severity: "error" })]);
});

it("retains standalone root extension API versions", async () => {
  const root = await createFixture({
    "extensions/function/legacy.extension.toml": 'type = "function"\napi_version = "2026-07"',
  });
  expect(await apiVersionContract.run({ root, minimumApiVersion: "2026-04" })).toEqual([]);
  expect(await apiVersionContract.run({ root, maximumApiVersion: "2026-04" })).toHaveLength(1);
});

it("uses reviewed entry overrides when an unused root default is older", async () => {
  const root = await createFixture({
    "extensions/function/shopify.extension.toml":
      'api_version = "2020-01"\n[[extensions]]\ntype = "function"\napi_version = "2026-07"',
  });
  expect(await apiVersionContract.run({ root, minimumApiVersion: "2026-04" })).toEqual([]);
});

it("warns when the app server API version differs from the selected webhook manifest", async () => {
  const root = await createFixture({
    "shopify.app.toml": '[webhooks]\napi_version = "2026-07"',
    "app/shopify.server.ts": `
      // apiVersion: ApiVersion.January24 was the scaffolded value
      const shopify = shopifyApp({ apiKey, apiVersion: ApiVersion.April26, distribution });
    `,
  });
  expect(await apiVersionContract.run({ root })).toEqual([
    {
      check: "api-version-contract",
      docs: expect.any(String),
      path: "app/shopify.server.ts",
      severity: "warning",
      message: expect.stringMatching(/Admin API 2026-04 while shopify\.app\.toml delivers webhooks at 2026-07/u),
    },
  ]);
});

it("accepts matching enum and string server versions and leaves dynamic values unresolved", async () => {
  const root = await createFixture({
    "shopify.app.toml": '[webhooks]\napi_version = "2026-07"',
    "app/shopify.server.ts": "shopifyApp({ apiVersion: ApiVersion.July26 });",
    "src/shopify.server.js": 'shopifyApp({ apiVersion: "2026-07" });',
    "shopify.server.ts": "shopifyApp({ apiVersion: LATEST_API_VERSION, restApiVersion: null });",
    "app/other.server.ts": "shopifyApp({ apiVersion: ApiVersion.January24 });",
  });
  expect(await apiVersionContract.run({ root })).toEqual([]);
});

it("applies version bounds to the app server and honours explicit server entries", async () => {
  const root = await createFixture({
    "shopify.app.toml": '[webhooks]\napi_version = "2026-04"',
    "web/index.js": 'const shopify = shopifyApp({ api: { apiVersion: "2025-01" } });',
  });
  expect(await apiVersionContract.run({ root, minimumApiVersion: "2025-10" })).toEqual([]);
  expect(
    (
      await apiVersionContract.run({
        root,
        minimumApiVersion: "2025-10",
        serverEntries: ["web/index.js"],
      })
    ).map((finding) => [finding.severity, finding.path]),
  ).toEqual([
    ["error", "web/index.js"],
    ["warning", "web/index.js"],
  ]);
  expect(await apiVersionContract.run({ root, serverEntries: ["web/missing.js"] })).toEqual([
    expect.objectContaining({ severity: "error", path: "web/missing.js" }),
  ]);
  await expect(apiVersionContract.run({ root, serverEntries: [""] })).rejects.toThrow("serverEntries");
});
