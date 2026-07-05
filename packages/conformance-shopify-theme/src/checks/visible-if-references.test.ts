import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { visibleIfReferences } from "./visible-if-references.js";

it("passes when visible_if references existing settings", async () => {
  const root = await createFixture({
    "blocks/badge.liquid":
      '{% schema %}{ "settings": [{ "type": "checkbox", "id": "show" }, { "type": "text", "id": "label", "visible_if": "{{ block.settings.show }}" }] }{% endschema %}',
  });
  expect(await visibleIfReferences.run({ root })).toEqual([]);
});

it("reports visible_if referencing missing settings", async () => {
  const root = await createFixture({
    "blocks/badge.liquid":
      '{% schema %}{ "settings": [{ "type": "text", "id": "label", "visible_if": "{{ block.settings.ghost }}" }] }{% endschema %}',
  });
  const findings = await visibleIfReferences.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining('missing setting "ghost"')]);
});
