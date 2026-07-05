import { expect, it } from "vitest";
import { headingOrder } from "./heading-order.js";
import { createFixture } from "./test-support.js";

it("allows h1 in route-owning sections", async () => {
  const root = await createFixture({
    "sections/product.liquid": "<h1>{{ product.title }}</h1>",
  });
  expect(await headingOrder.run({ root })).toEqual([]);
});

it("reports h1 in blocks", async () => {
  const root = await createFixture({
    "blocks/heading.liquid": "<h1>{{ block.settings.text }}</h1>",
  });
  const findings = await headingOrder.run({ root });
  expect(findings.map((finding) => finding.severity)).toEqual(["error"]);
});

it("warns for h1 in non-route sections", async () => {
  const root = await createFixture({
    "sections/newsletter.liquid": "<h1>Subscribe</h1>",
  });
  const findings = await headingOrder.run({ root });
  expect(findings.map((finding) => finding.severity)).toEqual(["warning"]);
});
