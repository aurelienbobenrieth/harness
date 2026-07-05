import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { localesDefault } from "./locales-default.js";

it("passes with one default locale and valid JSON", async () => {
  const root = await createFixture({
    "locales/en.default.json": '{ "general": { "close": "Close" } }',
    "locales/fr.json": '{ "general": { "close": "Fermer" } }',
  });

  expect(await localesDefault.run({ root })).toEqual([]);
});

it("reports when no default locale exists", async () => {
  const root = await createFixture({ "locales/en.json": "{}" });

  const findings = await localesDefault.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("default.json");
});

it("reports invalid locale JSON", async () => {
  const root = await createFixture({
    "locales/en.default.json": "{ not json",
  });

  const findings = await localesDefault.run({ root });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("valid JSON");
});
