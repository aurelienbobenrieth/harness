import { expect, it } from "vitest";
import { landmarks } from "./landmarks.js";
import { createFixture } from "./test-support.js";

it("passes when the layout owns exactly one main", async () => {
  const root = await createFixture({
    "layout/theme.liquid": '<body><main id="main">{{ content_for_layout }}</main></body>',
    "sections/hero.liquid": "<section>hero</section>",
  });
  expect(await landmarks.run({ root })).toEqual([]);
});

it("reports a layout without a main landmark", async () => {
  const root = await createFixture({
    "layout/theme.liquid": "<body>{{ content_for_layout }}</body>",
  });
  const findings = await landmarks.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("0 main landmarks")]);
});

it("reports sections that declare their own main", async () => {
  const root = await createFixture({
    "layout/theme.liquid": "<body><main>{{ content_for_layout }}</main></body>",
    "sections/hero.liquid": "<main>hero</main>",
  });
  const findings = await landmarks.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("sections/hero.liquid")]);
});
