import { expect, it } from "vitest";
import { metaCompleteness } from "./meta-completeness.js";
import { createFixture } from "./test-support.js";

const fullMetaSnippet = `
<link rel="canonical" href="{{ canonical_url }}">
<meta name="description" content="{{ page_description }}">
<meta property="og:title" content="{{ page_title }}">
<meta property="og:description" content="{{ page_description }}">
<meta property="og:image" content="{{ page_image | image_url }}">
<meta property="og:url" content="{{ canonical_url }}">
<meta name="twitter:card" content="summary_large_image">
`;

it("passes when the head renders the full meta contract", async () => {
  const root = await createFixture({ "snippets/meta-tags.liquid": fullMetaSnippet });
  expect(await metaCompleteness.run({ root })).toEqual([]);
});

it("reports each missing meta marker", async () => {
  const root = await createFixture({
    "layout/theme.liquid": '<link rel="canonical" href="{{ canonical_url }}">',
  });
  const findings = await metaCompleteness.run({ root });
  expect(findings.length).toBeGreaterThanOrEqual(5);
  expect(findings.map((finding) => finding.message)).toContainEqual(expect.stringContaining("og:title"));
});
