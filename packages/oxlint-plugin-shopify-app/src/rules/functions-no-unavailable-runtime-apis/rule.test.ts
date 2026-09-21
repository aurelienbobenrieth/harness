import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/functions-no-unavailable-runtime-apis";
const filename = "extensions/discount/src/run.ts";

it.each([
  [
    "an async run target",
    "export async function cartLinesDiscountsGenerateRun(input) { return { operations: [] }; }\n",
  ],
  ["an async arrow", "export const run = async (input) => ({ operations: [] });\n"],
  ["top-level await", "const data = await load();\nexport const run = () => data;\n"],
  ["a promise chain", "export function run() { load().then((value) => value); return { operations: [] }; }\n"],
  ["new Promise", "export function run() { return new Promise((resolve) => resolve(1)); }\n"],
  ["fetch", 'export function run() { fetch("https://example.com"); return { operations: [] }; }\n'],
  [
    "qualified fetch",
    'export function run() { globalThis.fetch("https://example.com"); return { operations: [] }; }\n',
  ],
  ["crypto", "export function run() { return { id: crypto.randomUUID() }; }\n"],
  ["URL", "export function run(input) { return new URL(input.url).host; }\n"],
  ["process", "export function run() { return process.env.MODE; }\n"],
  ["a node: import", 'import { createHash } from "node:crypto";\nexport const run = () => createHash;\n'],
  ["the clock", "export function run() { if (new Date().getHours() < 18) return { operations: [] }; return null; }\n"],
  ["Date.now", "export function run() { return Date.now(); }\n"],
  ["Math.random", "export function run() { return Math.random() > 0.5; }\n"],
])("reports %s", async (_label, code) => {
  await expect(assertRuleReports(ruleName, code, { filename })).resolves.toBeUndefined();
});

it("accepts synchronous, deterministic Function code and near misses", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import type { URL as NodeUrl } from "node:url";
type Input = { fetch: string; process: { URL: NodeUrl } };
export function cartLinesDiscountsGenerateRun(input: Input & Record<string, any>) {
  const startsAt = new Date(input.discount.startsAt);
  const parsed = Date.parse(input.discount.endsAt);
  const rounded = Math.round(input.cart.cost.subtotalAmount.amount);
  const fetch = input.fetch;
  const result = { process: input.process, URL: input.url, then: 1 };
  if (input.shop.localTime.timeBetween) return { operations: [], startsAt, parsed, rounded, fetch, result };
  return { operations: [input.thing.then, input.crypto, input.list.then(1)] };
}
`,
      { filename },
    ),
  ).resolves.toBeUndefined();
});
