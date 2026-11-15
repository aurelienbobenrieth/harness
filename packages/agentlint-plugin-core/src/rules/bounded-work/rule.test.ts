import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { boundedWork } from "./rule.js";

it.each([
  ["for (const item of items) { await repo.save(item); }", 1],
  ["await Promise.all(items.map(item => client.send(item)));", 1],
  ["const result = items.map(item => item.id);", 0],
  ["await client.open(); await client.read(); await client.close();", 0],
  ["export const options = { timeoutMS: 120_000 };", 0],
  ["export const options = { timeoutMS: 5_000 };", 0],
  ["for (let i = 0; i < 3; i++) { await fetch(url); }", 0],
  ["for (const item of [one, two]) { await fetch(item); }", 0],
  ["for (const item of items) { const later = async () => { await fetch(item); }; }", 0],
  ["while (hasNext()) { await fetch(url); }", 1],
  ["do { await fetch(url); } while (hasNext());", 1],
])("reviews the dynamic I/O operation in %s", async (source, count) => {
  expect(await testRuleOnSource({ rule: boundedWork, source })).toHaveLength(count);
});
