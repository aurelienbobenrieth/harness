import { expect, it } from "vitest";
import { contrastGuard } from "./contrast-guard.js";
import { createFixture } from "./test-support.js";

const settingsData = (schemes: Record<string, Record<string, string>>): string =>
  JSON.stringify({
    current: {
      color_schemes: Object.fromEntries(Object.entries(schemes).map(([id, settings]) => [id, { settings }])),
    },
  });

it("passes for high-contrast schemes", async () => {
  const root = await createFixture({
    "config/settings_data.json": settingsData({ "scheme-1": { background: "#ffffff", text: "#111111" } }),
  });
  expect(await contrastGuard.run({ root })).toEqual([]);
});

it("reports low-contrast text/background pairs", async () => {
  const root = await createFixture({
    "config/settings_data.json": settingsData({ "scheme-1": { background: "#ffffff", text: "#cccccc" } }),
  });
  const findings = await contrastGuard.run({ root });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining("below 4.5:1")]);
});

it("honours a configured minimum ratio", async () => {
  const root = await createFixture({
    "config/settings_data.json": settingsData({ "scheme-1": { background: "#ffffff", text: "#767676" } }),
  });
  expect(await contrastGuard.run({ root, contrastMinRatio: 4.5 })).toEqual([]);
  const strict = await contrastGuard.run({ root, contrastMinRatio: 7 });
  expect(strict).toHaveLength(1);
});
