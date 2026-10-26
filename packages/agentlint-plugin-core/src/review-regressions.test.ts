import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { boundedDataAccess, boundedWork } from "./index.js";

// Anonymized from KeepCart's SQL setup and request handlers, and Studio's tooling.
it("does not multiply a SQL command into findings on every wrapping call", async () => {
  const source =
    'const run = Effect.fn("setup")(function* () { return yield* Effect.tryPromise(() => client.query("CREATE TABLE items (id int)")); });';
  expect(await testRuleOnSource({ rule: boundedDataAccess, source, file: "src/repository.ts" })).toEqual([]);
});

it("sees a fluent limit on the complete select chain", async () => {
  const source = "const rows = await client.select().from(items).limit(10);";
  expect(await testRuleOnSource({ rule: boundedDataAccess, source })).toEqual([]);
});

it("reports an unbounded list once, without reporting its caller", async () => {
  const source = "const rows = trace(() => client.items.findMany({}));";
  expect(await testRuleOnSource({ rule: boundedDataAccess, source })).toHaveLength(1);
});

it("does not infer unbounded work from a pure map and unrelated awaited calls", async () => {
  const source =
    "async function load(items) { const ids = items.map(item => item.id); await client.open(); await client.read(); await client.close(); return ids; }";
  expect(await testRuleOnSource({ rule: boundedWork, source })).toEqual([]);
});

it("keeps finite test sequences and explicit runtime budgets silent", async () => {
  const source =
    "const config = { timeoutMs: 120_000 }; async function check() { await first(); await second(); await third(); }";
  expect(await testRuleOnSource({ rule: boundedWork, source, file: "src/handler.test.ts" })).toEqual([]);
});

it("reports dynamic I/O fan-out once at its collection boundary", async () => {
  const source = "async function send(items) { await Promise.all(items.map(item => client.send(item))); }";
  expect(await testRuleOnSource({ rule: boundedWork, source })).toHaveLength(1);
});

it("does not confuse a fixed parallel batch with unbounded fan-out", async () => {
  const source = "await Promise.all([first, second].map(item => client.send(item)));";
  expect(await testRuleOnSource({ rule: boundedWork, source })).toEqual([]);
});
