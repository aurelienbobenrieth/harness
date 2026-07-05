import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { settingsSchema } from "./settings-schema.js";

it("passes when theme_info is declared", async () => {
  const root = await createFixture({
    "config/settings_schema.json": '[{ "name": "theme_info", "theme_name": "Aurora", "theme_version": "1.0.0" }]',
  });

  expect(await settingsSchema.run({ root })).toEqual([]);
});

it("reports missing theme_info", async () => {
  const root = await createFixture({
    "config/settings_schema.json": '[{ "name": "Colors", "settings": [] }]',
  });

  const findings = await settingsSchema.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("theme_info");
});

it("reports invalid JSON", async () => {
  const root = await createFixture({ "config/settings_schema.json": "[" });

  const findings = await settingsSchema.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("valid JSON");
});
