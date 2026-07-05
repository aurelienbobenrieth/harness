import { expect, it } from "vitest";
import { presetCompleteness } from "./preset-completeness.js";
import { createFixture } from "./test-support.js";

it("passes for blocks with named presets", async () => {
  const root = await createFixture({
    "blocks/price.liquid": '{% schema %}{ "presets": [{ "name": "Price" }] }{% endschema %}',
  });
  expect(await presetCompleteness.run({ root })).toEqual([]);
});

it("reports blocks with schemas but no presets", async () => {
  const root = await createFixture({
    "blocks/price.liquid": '{% schema %}{ "name": "Price" }{% endschema %}',
  });
  const findings = await presetCompleteness.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("no presets")]);
});

it("reports presets without names", async () => {
  const root = await createFixture({
    "blocks/price.liquid": '{% schema %}{ "presets": [{ "settings": {} }] }{% endschema %}',
  });
  const findings = await presetCompleteness.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("without a name")]);
});
