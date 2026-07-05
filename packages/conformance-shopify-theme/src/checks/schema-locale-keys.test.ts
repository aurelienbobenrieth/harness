import { expect, it } from "vitest";
import { schemaLocaleKeys } from "./schema-locale-keys.js";
import { createFixture } from "./test-support.js";

it("passes when schema t: keys exist", async () => {
  const root = await createFixture({
    "locales/en.default.schema.json": '{ "names": { "price": "Price" } }',
    "blocks/price.liquid": '{% schema %}{ "name": "t:names.price" }{% endschema %}',
  });
  expect(await schemaLocaleKeys.run({ root })).toEqual([]);
});

it("reports missing schema locale keys", async () => {
  const root = await createFixture({
    "locales/en.default.schema.json": "{}",
    "blocks/price.liquid": '{% schema %}{ "name": "t:names.price" }{% endschema %}',
  });
  const findings = await schemaLocaleKeys.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("t:names.price")]);
});

it("reports a missing default schema locale file", async () => {
  const root = await createFixture({});
  const findings = await schemaLocaleKeys.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("default.schema.json")]);
});
