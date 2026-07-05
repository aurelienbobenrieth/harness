import { expect, it } from "vitest";
import { orphanLocaleKeys } from "./orphan-locale-keys.js";
import { createFixture } from "./test-support.js";

it("passes when locale keys and usages line up", async () => {
  const root = await createFixture({
    "locales/en.default.json": '{ "cart": { "title": "Cart" } }',
    "sections/cart.liquid": "{{ 'cart.title' | t }}",
  });
  expect(await orphanLocaleKeys.run({ root })).toEqual([]);
});

it("reports keys used in Liquid but missing from the locale", async () => {
  const root = await createFixture({
    "locales/en.default.json": "{}",
    "sections/cart.liquid": "{{ 'cart.title' | t }}",
  });
  const findings = await orphanLocaleKeys.run({ root });
  expect(findings.map((finding) => `${finding.severity} ${finding.message}`)).toEqual([
    expect.stringContaining('error "cart.title" is used'),
  ]);
});

it("warns for unused locale keys", async () => {
  const root = await createFixture({
    "locales/en.default.json": '{ "cart": { "title": "Cart", "ghost": "?" } }',
    "sections/cart.liquid": "{{ 'cart.title' | t }}",
  });
  const findings = await orphanLocaleKeys.run({ root });
  expect(findings.map((finding) => `${finding.severity} ${finding.message}`)).toEqual([
    expect.stringContaining('warning locales/en.default.json declares "cart.ghost"'),
  ]);
});
