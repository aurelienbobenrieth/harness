import { expect, it } from "vitest";
import { imagePolicy } from "./image-policy.js";
import { createFixture } from "./test-support.js";

it("passes for sized, strategy-declaring images", async () => {
  const root = await createFixture({
    "sections/grid.liquid": "{{ image | image_url: width: 600 | image_tag: loading: 'lazy' }}",
  });
  expect(await imagePolicy.run({ root })).toEqual([]);
});

it("reports image_url without width", async () => {
  const root = await createFixture({
    "sections/grid.liquid": "{{ image | image_url | image_tag: loading: 'lazy' }}",
  });
  const findings = await imagePolicy.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("image_url without width")]);
});

it("reports raw img tags without a loading attribute", async () => {
  const root = await createFixture({
    "snippets/logo.liquid": '<img src="logo.png" alt="Logo" width="120" height="40">',
  });
  const findings = await imagePolicy.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("loading attribute")]);
});
