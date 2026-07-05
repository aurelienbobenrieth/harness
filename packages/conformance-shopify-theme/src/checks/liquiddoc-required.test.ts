import { expect, it } from "vitest";
import { liquiddocRequired } from "./liquiddoc-required.js";
import { createFixture } from "./test-support.js";

it("passes when snippets carry doc headers", async () => {
  const root = await createFixture({
    "snippets/icon.liquid": "{% doc %}\n  Renders an icon.\n  @param name {string}\n{% enddoc %}\n<svg></svg>",
    "blocks/price.liquid": '{% schema %}{ "name": "Price" }{% endschema %}',
  });
  expect(await liquiddocRequired.run({ root })).toEqual([]);
});

it("reports snippets without doc headers", async () => {
  const root = await createFixture({ "snippets/icon.liquid": "<svg></svg>" });
  const findings = await liquiddocRequired.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("snippets/icon.liquid")]);
});

it("reports schema-less blocks without doc headers", async () => {
  const root = await createFixture({ "blocks/_internal.liquid": "<div></div>" });
  const findings = await liquiddocRequired.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("blocks/_internal.liquid")]);
});
