import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { noParserBlockingScripts } from "./no-parser-blocking-scripts.js";

it("passes for deferred and module scripts", async () => {
  const root = await createFixture({
    "layout/theme.liquid":
      '<script src="{{ \'cart.js\' | asset_url }}" defer></script>\n<script type="module" src="{{ \'app.js\' | asset_url }}"></script>\n',
  });

  expect(await noParserBlockingScripts.run({ root })).toEqual([]);
});

it("reports parser-blocking scripts", async () => {
  const root = await createFixture({
    "sections/hero.liquid": "<script src=\"{{ 'hero.js' | asset_url }}\"></script>\n",
  });

  const findings = await noParserBlockingScripts.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("parser-blocking");
});

it("ignores inline scripts", async () => {
  const root = await createFixture({
    "snippets/analytics.liquid": "<script>console.log('inline');</script>\n",
  });

  expect(await noParserBlockingScripts.run({ root })).toEqual([]);
});
