import { expect, it } from "vitest";
import { lcpPriority } from "./lcp-priority.js";
import { createFixture } from "./test-support.js";

it("passes when eager media sets fetchpriority high", async () => {
  const root = await createFixture({
    "sections/hero.liquid": "{{ image | image_url: width: 1200 | image_tag: loading: 'eager', fetchpriority: 'high' }}",
  });
  expect(await lcpPriority.run({ root })).toEqual([]);
});

it("reports eager media without fetchpriority", async () => {
  const root = await createFixture({
    "sections/hero.liquid": "{{ image | image_url: width: 1200 | image_tag: loading: 'eager' }}",
  });
  const findings = await lcpPriority.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("fetchpriority")]);
});

it("ignores lazy media", async () => {
  const root = await createFixture({
    "sections/grid.liquid": "{{ image | image_url: width: 600 | image_tag: loading: 'lazy' }}",
  });
  expect(await lcpPriority.run({ root })).toEqual([]);
});
