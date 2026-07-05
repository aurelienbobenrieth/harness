import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { seoContract } from "./seo-contract.js";

const compliantLayout = `<html lang="en">
  <head>
    <link rel="canonical" href="{{ canonical_url }}">
    <meta name="description" content="{{ page_description | escape }}">
    <meta property="og:title" content="{{ page_title }}">
    {{ content_for_header }}
  </head>
  <body>{{ content_for_layout }}</body>
</html>
`;

it("passes for a theme with the full SEO contract", async () => {
  const root = await createFixture({
    "layout/theme.liquid": compliantLayout,
    "snippets/structured-data.liquid": '<script type="application/ld+json">{{ product | structured_data }}</script>',
    "templates/product.json": '{ "sections": { "main": { "type": "main-product" } }, "order": ["main"] }',
  });

  expect(await seoContract.run({ root })).toEqual([]);
});

it("reports missing canonical and description as errors", async () => {
  const root = await createFixture({
    "layout/theme.liquid": '<html lang="en"><head>{{ content_for_header }}</head><body></body></html>\n',
  });

  const findings = await seoContract.run({ root });
  const errors = findings.filter((finding) => finding.severity === "error");
  expect(errors.map((finding) => finding.message)).toEqual([
    expect.stringContaining("canonical"),
    expect.stringContaining("meta description"),
  ]);
});

it("warns about missing structured data only for product themes", async () => {
  const root = await createFixture({
    "layout/theme.liquid": compliantLayout,
    "templates/product.json": '{ "sections": { "main": { "type": "main-product" } }, "order": ["main"] }',
  });

  const findings = await seoContract.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.severity).toBe("warning");
  expect(findings[0]?.message).toContain("JSON-LD");
});
