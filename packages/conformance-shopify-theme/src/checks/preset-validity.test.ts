import { expect, it } from "vitest";
import { presetValidity } from "./preset-validity.js";
import { createFixture } from "./test-support.js";

it("passes when presets configure existing settings", async () => {
  const root = await createFixture({
    "blocks/badge.liquid":
      '{% schema %}{ "settings": [{ "type": "text", "id": "label" }], "presets": [{ "name": "Badge", "settings": { "label": "New" } }] }{% endschema %}',
  });
  expect(await presetValidity.run({ root })).toEqual([]);
});

it("reports presets that set unknown settings", async () => {
  const root = await createFixture({
    "blocks/badge.liquid":
      '{% schema %}{ "settings": [{ "type": "text", "id": "label" }], "presets": [{ "name": "Badge", "settings": { "colour": "red" } }] }{% endschema %}',
  });
  const findings = await presetValidity.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining('unknown setting "colour"')]);
});
