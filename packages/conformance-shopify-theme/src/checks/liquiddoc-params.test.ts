import { expect, it } from "vitest";
import { liquiddocParams } from "./liquiddoc-params.js";
import { createFixture } from "./test-support.js";

it("passes when documented params are used", async () => {
  const root = await createFixture({
    "snippets/icon.liquid": "{% doc %}\n  @param name {string}\n{% enddoc %}\n{{ name }}",
  });
  expect(await liquiddocParams.run({ root })).toEqual([]);
});

it("reports documented params that are never used", async () => {
  const root = await createFixture({
    "snippets/icon.liquid": "{% doc %}\n  @param name {string}\n  @param size {number}\n{% enddoc %}\n{{ name }}",
  });
  const findings = await liquiddocParams.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining('"size"')]);
});
