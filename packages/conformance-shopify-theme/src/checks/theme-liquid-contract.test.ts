import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { themeLiquidContract } from "./theme-liquid-contract.js";

const compliantLayout = `<!doctype html>
<html lang="{{ request.locale.iso_code }}">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {{ content_for_header }}
  </head>
  <body>
    {{ content_for_layout }}
  </body>
</html>
`;

it("passes for a compliant layout", async () => {
  const root = await createFixture({ "layout/theme.liquid": compliantLayout });

  expect(await themeLiquidContract.run({ root })).toEqual([]);
});

it("reports missing required objects and attributes", async () => {
  const root = await createFixture({ "layout/theme.liquid": "<html><body></body></html>\n" });

  const findings = await themeLiquidContract.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([
    expect.stringContaining("content_for_header"),
    expect.stringContaining("content_for_layout"),
    expect.stringContaining("lang"),
    expect.stringContaining("viewport"),
  ]);
});

it("reports zoom-blocking viewport tags", async () => {
  const root = await createFixture({
    "layout/theme.liquid": compliantLayout.replace(
      'content="width=device-width, initial-scale=1"',
      'content="width=device-width, initial-scale=1, user-scalable=no"',
    ),
  });

  const findings = await themeLiquidContract.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("zoom");
});
