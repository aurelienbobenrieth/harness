import { expect, it } from "vitest";
import { polarisCdnTrack } from "./polaris-cdn-track.js";
import { createFixture } from "./test-support.js";

const types = (version: string) => ({
  "package.json": JSON.stringify({ devDependencies: { "@shopify/polaris-types": version } }),
  "node_modules/@shopify/polaris-types/package.json": JSON.stringify({ name: "@shopify/polaris-types", version }),
});
const document = (file: string) =>
  `<html><head><script src="https://cdn.shopify.com/shopifycloud/${file}"></script></head></html>`;

it.each(["polaris.js", "polaris-1.js", "polaris-1.1.js"])("accepts the 1.x channel %s with 1.x types", async (file) => {
  const root = await createFixture({ ...types("1.1.0"), "index.html": document(file) });
  expect(await polarisCdnTrack.run({ root })).toEqual([]);
});

it.each([
  ["polaris.js", "2.0.0", 1, "polaris-2.js"],
  ["polaris-1.js", "2.0.0", 1, "polaris-2.js"],
  ["polaris-2.js", "1.1.0", 2, "polaris-1.js"],
  ["polaris-1.js", "2.0.0-rc.0", 1, "polaris-2.0-rc.js"],
])("reports %s loaded against @shopify/polaris-types %s", async (file, version, cdnMajor, expectedScript) => {
  const root = await createFixture({ ...types(version), "index.html": document(file) });
  expect(await polarisCdnTrack.run({ root })).toEqual([
    expect.objectContaining({
      severity: "error",
      path: expect.stringContaining("index.html"),
      message: expect.stringContaining(`Loads Polaris ${cdnMajor}.x from ${file}`),
    }),
  ]);
  expect((await polarisCdnTrack.run({ root }))[0]?.message).toContain(`load ${expectedScript} or install`);
});

it("accepts a matching pinned major in a JSX root layout", async () => {
  const root = await createFixture({
    ...types("2.0.0"),
    "app/root.tsx":
      'export default () => <head><script src="https://cdn.shopify.com/shopifycloud/polaris-2.0.js" /></head>;',
  });
  expect(await polarisCdnTrack.run({ root })).toEqual([]);
});

it("stays silent without a CDN script or without the types package", async () => {
  const noScript = await createFixture({ ...types("2.0.0"), "index.html": "<head></head>" });
  expect(await polarisCdnTrack.run({ root: noScript })).toEqual([]);
  const noTypes = await createFixture({ "index.html": document("polaris.js") });
  expect(await polarisCdnTrack.run({ root: noTypes })).toEqual([]);
});

it("ignores commented-out scripts", async () => {
  const root = await createFixture({
    ...types("2.0.0"),
    "index.html": `<head><!-- ${document("polaris.js")} --></head>`,
  });
  expect(await polarisCdnTrack.run({ root })).toEqual([]);
});

it("warns when the types package is declared but not installed", async () => {
  const root = await createFixture({
    "package.json": JSON.stringify({ dependencies: { "@shopify/polaris-types": "^2.0.0" } }),
    "index.html": document("polaris.js"),
  });
  expect(await polarisCdnTrack.run({ root })).toEqual([
    expect.objectContaining({ severity: "warning", path: "package.json" }),
  ]);
});

it("checks only the explicitly selected documents", async () => {
  const root = await createFixture({
    ...types("1.1.0"),
    "index.html": document("polaris-1.js"),
    "examples/legacy/index.html": document("polaris-2.js"),
  });
  expect(await polarisCdnTrack.run({ root })).toHaveLength(1);
  expect(await polarisCdnTrack.run({ root, documentEntries: ["index.html"] })).toEqual([]);
});

it.each([
  ["polaris-1.1-rc.js", "1.1.0"],
  ["polaris-2.0-rc.js", "2.0.0-rc.0"],
])("warns, without an error, on the release candidate %s with matching types %s", async (file, version) => {
  const root = await createFixture({ ...types(version), "index.html": document(file) });
  expect(await polarisCdnTrack.run({ root })).toEqual([
    expect.objectContaining({
      severity: "warning",
      path: expect.stringContaining("index.html"),
      message: expect.stringContaining(`release candidate ${file}`),
    }),
  ]);
});
