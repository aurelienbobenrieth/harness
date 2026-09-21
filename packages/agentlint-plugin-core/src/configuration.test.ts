import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineBoundaryResilience, commentSignal, boundedWork } from "./index.js";

it("repeated checks with global patterns produce the same findings", async () => {
  const rule = defineBoundaryResilience({ networkCallPattern: /^fetch\(/g });
  const source = 'fetch("/one"); fetch("/two");';
  const first = await testRuleOnSource(rule, source);
  const second = await testRuleOnSource(rule, source);
  expect(first).toHaveLength(2);
  expect(second).toEqual(first);
});

it("material pattern options participate in the binding identity", async () => {
  const a = await testRuleOnSource(defineBoundaryResilience({ networkCallPattern: /^fetch\(/ }), 'fetch("/api")');
  const b = await testRuleOnSource(defineBoundaryResilience({ networkCallPattern: /fetch\(/ }), 'fetch("/api")');
  expect(a[0]?.source.bindingDigest).not.toEqual(b[0]?.source.bindingDigest);
});

it("keeps JavaScript type annotations and ignores I/O examples in comments", async () => {
  await expect(
    testRuleOnSource(commentSignal, "/** @param {string} id */\nfunction read(id) {}", "source.js"),
  ).resolves.toEqual([]);
  await expect(
    testRuleOnSource(boundedWork, "// await fetch(url); await client.get(); await api.get();\nconst pure=1;"),
  ).resolves.toEqual([]);
});
