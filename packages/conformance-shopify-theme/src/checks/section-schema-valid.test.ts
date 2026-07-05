import { expect, it } from "vitest";
import { sectionSchemaValid } from "./section-schema-valid.js";
import { createFixture } from "./test-support.js";

it("passes for valid schemas", async () => {
  const root = await createFixture({
    "blocks/price.liquid":
      '{% schema %}{ "name": "Price", "settings": [{ "type": "text", "id": "label" }] }{% endschema %}',
  });
  expect(await sectionSchemaValid.run({ root })).toEqual([]);
});

it("reports invalid schema JSON", async () => {
  const root = await createFixture({
    "sections/hero.liquid": "{% schema %}{ not json }{% endschema %}",
  });
  const findings = await sectionSchemaValid.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("not valid JSON")]);
});

it("reports duplicate setting ids", async () => {
  const root = await createFixture({
    "blocks/price.liquid":
      '{% schema %}{ "settings": [{ "type": "text", "id": "label" }, { "type": "text", "id": "label" }] }{% endschema %}',
  });
  const findings = await sectionSchemaValid.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining('"label" more than once')]);
});
