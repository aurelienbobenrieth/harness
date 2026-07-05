import { expect, it } from "vitest";
import { registrySync } from "./registry-sync.js";
import { createFixture } from "./test-support.js";

const registry = (entries: unknown[]): string => JSON.stringify({ primitives: entries });

it("passes when registry and disk agree", async () => {
  const root = await createFixture({
    "registry.json": registry([
      {
        id: "content.price",
        status: "implemented",
        surface: "merchant",
        delivery: "block",
        path: "blocks/price.liquid",
      },
    ]),
    "blocks/price.liquid": '{% schema %}{ "name": "Price" }{% endschema %}',
  });
  expect(await registrySync.run({ root })).toEqual([]);
});

it("reports a missing registry", async () => {
  const root = await createFixture({});
  const findings = await registrySync.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("registry.json is missing")]);
});

it("reports implemented entries without files", async () => {
  const root = await createFixture({
    "registry.json": registry([{ id: "content.price", status: "implemented", path: "blocks/price.liquid" }]),
  });
  const findings = await registrySync.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([
    expect.stringContaining("blocks/price.liquid does not exist"),
  ]);
});

it("reports unregistered blocks", async () => {
  const root = await createFixture({
    "registry.json": registry([]),
    "blocks/rogue.liquid": "<div></div>",
  });
  const findings = await registrySync.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([
    expect.stringContaining("blocks/rogue.liquid is not referenced"),
  ]);
});
