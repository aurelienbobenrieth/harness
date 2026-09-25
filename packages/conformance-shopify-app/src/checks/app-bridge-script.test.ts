import { expect, it } from "vitest";
import { appBridgeScript } from "./app-bridge-script.js";
import { createFixture } from "./test-support.js";

it("uses the same selected deployment for embedded-app ownership", async () => {
  const root = await createFixture({
    "shopify.app.production.toml": "embedded = false",
    "shopify.app.local.toml": "embedded = true",
    "index.html": "<html><head></head><body></body></html>",
  });
  expect(await appBridgeScript.run({ root, appManifest: "shopify.app.production.toml" })).toEqual([]);
  expect(await appBridgeScript.run({ root, appManifest: "shopify.app.local.toml" })).toEqual([
    expect.objectContaining({ severity: "error" }),
  ]);
});

it("passes when the document head loads the App Bridge script", async () => {
  const root = await createFixture({
    "shopify.app.toml": "embedded = true\n",
    "index.html": '<head><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script></head>\n',
  });

  expect(await appBridgeScript.run({ root })).toEqual([]);
});

it("passes when a platform injector marker is present", async () => {
  const root = await createFixture({
    "shopify.app.toml": "embedded = true\n",
    "index.html": "<head><script>window.GADGET_CONFIG = {};</script></head>\n",
  });

  expect(await appBridgeScript.run({ root, platformMarkers: ["GADGET_CONFIG"] })).toEqual([]);
});

it("reports embedded documents without the script", async () => {
  const root = await createFixture({
    "shopify.app.toml": "embedded = true\n",
    "app/root.tsx": "export default function Root() {\n  return <html><head /><body /></html>;\n}\n",
  });

  const findings = await appBridgeScript.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("error");
});

it("skips non-embedded apps", async () => {
  const root = await createFixture({
    "shopify.app.toml": "embedded = false\n",
    "index.html": "<head></head>\n",
  });

  expect(await appBridgeScript.run({ root })).toEqual([]);
});

it("does not accept an App Bridge script placed in the body", async () => {
  const root = await createFixture({
    "index.html":
      '<html><head></head><body><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script></body></html>',
  });
  expect(await appBridgeScript.run({ root })).toEqual([expect.objectContaining({ severity: "error" })]);
});

it("requires App Bridge before every other script in each discovered document", async () => {
  const root = await createFixture({
    "index.html": '<head><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script></head>',
    "app/root.tsx":
      '<head><script src="/app.js"></script><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script></head>',
  });
  expect(await appBridgeScript.run({ root })).toEqual([
    expect.objectContaining({ path: expect.stringContaining("root.tsx") }),
  ]);
  expect(await appBridgeScript.run({ root, documentEntries: ["index.html"] })).toEqual([]);
});

it("reports missing explicit documents and rejects empty or escaping scopes", async () => {
  const root = await createFixture({});
  expect(await appBridgeScript.run({ root, documentEntries: ["missing.html"] })).toEqual([
    expect.objectContaining({ severity: "error" }),
  ]);
  await expect(appBridgeScript.run({ root, documentEntries: [] })).rejects.toThrow("documentEntries");
  await expect(appBridgeScript.run({ root, documentEntries: ["../outside.html"] })).rejects.toThrow("documentEntries");
  await expect(appBridgeScript.run({ root, platformMarkers: [""] })).rejects.toThrow("platformMarkers");
});
