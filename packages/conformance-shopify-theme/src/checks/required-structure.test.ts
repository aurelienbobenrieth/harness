import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { requiredStructure } from "./required-structure.js";

it("passes for a minimal valid theme", async () => {
  const root = await createFixture({
    "layout/theme.liquid": '<html lang="en"><body>{{ content_for_layout }}</body></html>\n',
    "assets/base.css": "body {}\n",
  });

  expect(await requiredStructure.run({ root })).toEqual([]);
});

it("reports a missing layout/theme.liquid", async () => {
  const root = await createFixture({ "assets/base.css": "body {}\n" });

  const findings = await requiredStructure.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("layout/theme.liquid");
});

it("reports nested asset directories", async () => {
  const root = await createFixture({
    "layout/theme.liquid": "{{ content_for_layout }}\n",
    "assets/icons/cart.svg": '<svg aria-hidden="true"></svg>\n',
  });

  const findings = await requiredStructure.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("flat");
});
