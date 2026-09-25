import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import {
  abstractionEarnsKeep,
  boundedWork,
  commentSignal,
  defineBoundaryResilience,
  flagForkedFunction,
  isomorphicMapping,
} from "./index.js";

it("reserves architectural tradeoff decisions for human authority", () => {
  expect([abstractionEarnsKeep, flagForkedFunction, isomorphicMapping].map((rule) => rule.binding.authority)).toEqual([
    "human",
    "human",
    "human",
  ]);
});

it("repeated checks with global patterns produce the same findings", async () => {
  const rule = defineBoundaryResilience({ networkCallPattern: /^fetch\(/g });
  const source = 'fetch("/one"); fetch("/two");';
  const first = await testRuleOnSource({ rule: rule, source: source });
  const second = await testRuleOnSource({ rule: rule, source: source });
  expect(first).toHaveLength(2);
  expect(second).toEqual(first);
});

it("material pattern options participate in the binding identity", async () => {
  const a = await testRuleOnSource({
    rule: defineBoundaryResilience({ networkCallPattern: /^fetch\(/ }),
    source: 'fetch("/api")',
  });
  const b = await testRuleOnSource({
    rule: defineBoundaryResilience({ networkCallPattern: /fetch\(/ }),
    source: 'fetch("/api")',
  });
  expect(a[0]?.source.bindingDigest).not.toEqual(b[0]?.source.bindingDigest);
});

it("keeps JavaScript type annotations and ignores I/O examples in comments", async () => {
  await expect(
    testRuleOnSource({
      rule: commentSignal,
      source: "/** @param {string} id */\nfunction read(id) {}",
      file: "source.js",
    }),
  ).resolves.toEqual([]);
  await expect(
    testRuleOnSource({
      rule: boundedWork,
      source: "// await fetch(url); await client.get(); await api.get();\nconst pure=1;",
    }),
  ).resolves.toEqual([]);
});
