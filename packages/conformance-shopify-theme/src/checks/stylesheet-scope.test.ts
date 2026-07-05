import { expect, it } from "vitest";
import { stylesheetScope } from "./stylesheet-scope.js";
import { createFixture } from "./test-support.js";

it("passes for class-scoped selectors", async () => {
  const root = await createFixture({
    "blocks/price.liquid":
      "{% stylesheet %}\n.price { color: var(--scheme-text); }\n.price__amount { font-weight: 600; }\n{% endstylesheet %}",
  });
  expect(await stylesheetScope.run({ root })).toEqual([]);
});

it("reports bare element selectors", async () => {
  const root = await createFixture({
    "blocks/price.liquid": "{% stylesheet %}\nspan { color: red; }\n{% endstylesheet %}",
  });
  const findings = await stylesheetScope.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining('"span"')]);
});

it("reports :root selectors", async () => {
  const root = await createFixture({
    "sections/hero.liquid": "{% stylesheet %}\n:root { --leak: 1; }\n{% endstylesheet %}",
  });
  const findings = await stylesheetScope.run({ root });
  expect(findings).toHaveLength(1);
});
