import { expect, it } from "vitest";
import { appUrlSecurity } from "./app-url-security.js";
import { createFixture } from "./test-support.js";

it("accepts secure app and callback URLs, including extension-only App Home", async () => {
  const root = await createFixture({
    "shopify.app.toml":
      'application_url = "https://shopify.dev/apps/default-app-home"\n[auth]\nredirect_urls = ["https://app.example/auth?tenant=one"]\n[customer_authentication]\nredirect_uris = ["https://app.example/customer/callback"]\njavascript_origins = ["https://app.example", "https://app.example:8443/"]',
  });
  expect(await appUrlSecurity.run({ root })).toEqual([]);
});

it.each([
  "http://app.example",
  "javascript:alert(1)",
  "//app.example",
  "https:app.example",
  "https://user:secret@app.example",
  " https://app.example",
  "https://app.example/a b",
])("rejects insecure or ambiguous application URL %s without echoing credentials", async (url) => {
  const root = await createFixture({
    "shopify.app.toml": `application_url = ${JSON.stringify(url)}`,
  });
  const findings = await appUrlSecurity.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({ severity: "error", path: "shopify.app.toml" });
  expect(JSON.stringify(findings)).not.toContain("secret");
});

it.each([
  "[auth]\nredirect_urls = []",
  '[auth]\nredirect_urls = "https://app.example"',
  '[auth]\nredirect_urls = ["http://app.example/auth"]',
  "[customer_authentication]\nredirect_uris = []",
  '[customer_authentication]\nredirect_uris = ["https://app.example"]\njavascript_origins = ["https://app.example/path"]',
])("rejects malformed callback configuration", async (config) => {
  const root = await createFixture({
    "shopify.app.toml": `application_url = "https://app.example"\n${config}`,
  });
  expect(await appUrlSecurity.run({ root })).toEqual([expect.objectContaining({ severity: "error" })]);
});

it("does not invent OAuth requirements for apps without an auth table", async () => {
  const root = await createFixture({
    "shopify.app.toml": 'application_url = "https://app.example"',
  });
  expect(await appUrlSecurity.run({ root })).toEqual([]);
});

it("keeps deployment selection and malformed or missing manifests visible", async () => {
  const root = await createFixture({
    "shopify.app.toml": 'application_url = "http://localhost"',
    "shopify.app.production.toml": 'application_url = "https://app.example"',
    "shopify.app.broken.toml": "[broken",
  });
  expect(await appUrlSecurity.run({ root, appManifest: "shopify.app.production.toml" })).toEqual([]);
  expect(await appUrlSecurity.run({ root, appManifest: "shopify.app.broken.toml" })).toHaveLength(1);
  expect(await appUrlSecurity.run({ root, appManifest: "shopify.app.missing.toml" })).toHaveLength(1);
});
