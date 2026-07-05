import { expect, it } from "vitest";
import { surfaceClasses } from "./surface-classes.js";
import { createFixture } from "./test-support.js";

const registry = (entries: unknown[]): string => JSON.stringify({ primitives: entries });

it("passes for a classified, well-formed registry", async () => {
  const root = await createFixture({
    "registry.json": registry([
      {
        id: "content.price",
        status: "implemented",
        surface: "merchant",
        delivery: "block",
        path: "blocks/price.liquid",
      },
      {
        id: "media.icon",
        status: "implemented",
        surface: "internal",
        delivery: "snippet",
        path: "snippets/icon.liquid",
      },
    ]),
    "blocks/price.liquid":
      '{% schema %}{ "name": "t:names.price", "settings": [{ "type": "text", "id": "label" }], "presets": [{ "name": "t:names.price" }] }{% endschema %}',
    "snippets/icon.liquid": "{% doc %}@param name{% enddoc %}<svg></svg>",
  });
  expect(await surfaceClasses.run({ root })).toEqual([]);
});

it("reports implemented entries without classification", async () => {
  const root = await createFixture({
    "registry.json": registry([{ id: "content.price", status: "implemented", path: "blocks/price.liquid" }]),
    "blocks/price.liquid": '{% schema %}{ "presets": [{ "name": "Price" }] }{% endschema %}',
  });
  const findings = await surfaceClasses.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("lacks surface/delivery")]);
});

it("reports merchant blocks without presets", async () => {
  const root = await createFixture({
    "registry.json": registry([
      {
        id: "content.price",
        status: "implemented",
        surface: "merchant",
        delivery: "block",
        path: "blocks/price.liquid",
      },
    ]),
    "blocks/price.liquid": '{% schema %}{ "name": "Price" }{% endschema %}',
  });
  const findings = await surfaceClasses.run({ root });
  expect(findings.map((finding) => finding.check)).toEqual(["surface-merchant-preset"]);
});

it("reports internal snippets with schemas or missing docs", async () => {
  const root = await createFixture({
    "registry.json": registry([
      {
        id: "media.icon",
        status: "implemented",
        surface: "internal",
        delivery: "snippet",
        path: "snippets/icon.liquid",
      },
    ]),
    "snippets/icon.liquid": '{% schema %}{ "name": "Icon" }{% endschema %}<svg></svg>',
  });
  const findings = await surfaceClasses.run({ root });
  expect(findings.map((finding) => finding.check)).toEqual(["surface-internal-hidden", "surface-internal-hidden"]);
});

it("reports presets that own liquid markup", async () => {
  const root = await createFixture({
    "registry.json": registry([
      {
        id: "preset.hero-split",
        status: "implemented",
        surface: "preset",
        delivery: "compound",
        path: "blocks/hero-split.liquid",
      },
    ]),
    "blocks/hero-split.liquid": "<div></div>",
  });
  const findings = await surfaceClasses.run({ root });
  expect(findings.map((finding) => finding.check)).toEqual(["surface-preset-thin"]);
});

it("reports enhancers that write innerHTML", async () => {
  const root = await createFixture({
    "registry.json": registry([
      {
        id: "cart.drawer",
        status: "implemented",
        surface: "internal",
        delivery: "enhancer",
        path: "frontend/features/cart-drawer/cart-drawer-enhancer.ts",
      },
    ]),
    "frontend/features/cart-drawer/cart-drawer-enhancer.ts": "element.innerHTML = markup;",
  });
  const findings = await surfaceClasses.run({ root });
  expect(findings.map((finding) => finding.check)).toEqual(["surface-enhancer-thin"]);
});
