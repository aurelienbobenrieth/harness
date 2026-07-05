import { expect, it } from "vitest";
import { createFixture } from "./test-support.js";
import { utilityGrammar } from "./utility-grammar.js";

it("stays silent without a configured safelist", async () => {
  const root = await createFixture({
    "templates/index.json":
      '{ "sections": { "a": { "type": "hero", "settings": { "custom_classes": "anything-goes" } } } }',
  });
  expect(await utilityGrammar.run({ root })).toEqual([]);
});

it("passes for safelisted classes", async () => {
  const root = await createFixture({
    "templates/index.json":
      '{ "sections": { "a": { "type": "hero", "settings": { "custom_classes": "u-hidden u-flush" } } } }',
  });
  expect(await utilityGrammar.run({ root, utilityClasses: ["u-hidden", "u-flush"] })).toEqual([]);
});

it("reports classes outside the safelist", async () => {
  const root = await createFixture({
    "templates/index.json":
      '{ "sections": { "a": { "type": "hero", "settings": { "custom_classes": "u-hidden rogue" } } } }',
  });
  const findings = await utilityGrammar.run({ root, utilityClasses: ["u-hidden"] });
  expect(findings.map((finding) => finding.message)).toEqual([expect.stringContaining('"rogue"')]);
});
