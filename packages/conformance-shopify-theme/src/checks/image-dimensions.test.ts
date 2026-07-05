import { expect, it } from "vitest";
import { imageDimensions } from "./image-dimensions.js";
import { createFixture } from "./test-support.js";

it("passes for image_tag with width and height", async () => {
  const root = await createFixture({
    "sections/hero.liquid": "{{ section.settings.image | image_url: width: 1200 | image_tag: loading: 'lazy' }}",
  });
  expect(await imageDimensions.run({ root })).toEqual([]);
});

it("reports image_tag without dimensions", async () => {
  const root = await createFixture({
    "sections/hero.liquid": "{{ section.settings.image | image_tag }}",
  });
  const findings = await imageDimensions.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([
    expect.stringContaining("image_tag without width/height"),
  ]);
});

it("reports raw img tags without dimensions", async () => {
  const root = await createFixture({
    "snippets/logo.liquid": '<img src="logo.png" alt="Logo">',
  });
  const findings = await imageDimensions.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("raw <img>")]);
});
