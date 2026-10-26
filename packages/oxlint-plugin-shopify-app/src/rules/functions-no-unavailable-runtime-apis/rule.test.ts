import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/functions-no-unavailable-runtime-apis";
const filename = "extensions/discount/src/run.ts";
const files = { "extensions/discount/shopify.extension.toml": '[[extensions]]\ntype = "function"\n' };

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
  await expect(assertRuleReports(ruleName, code, { filename, files })).resolves.toBeUndefined();
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
      { filename, files },
    ),
  ).resolves.toBeUndefined();
});

it.each(["app/routes/api.billing.ts", "extensions/admin/src/action.ts", "extensions/unconfigured/src/run.ts"])(
  "accepts server APIs outside a declared Function: %s",
  async (sourceFilename) => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        'import { randomUUID } from "node:crypto";\nexport async function action() { return fetch("https://billing.example/" + randomUUID()); }\n',
        {
          filename: sourceFilename,
          files: {
            "extensions/admin/shopify.extension.toml": '[[extensions]]\ntype = "ui_extension"\n# type = "function"\n',
          },
        },
      ),
    ).resolves.toBeUndefined();
  },
);

it("accepts the observed KeepCart agentlint hook process exit", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const input = readInput();\nif (input.stop_hook_active === true) process.exit(0);\nconst files = turnFiles(input.transcript_path);\nif (files?.length === 0) process.exit(0);\n",
      { filename: ".agentlint/hooks/agentlint-gate.mjs" },
    ),
  ).resolves.toBeUndefined();
});

it.each([
  ['type = "function"\n', true],
  ["invalid = [\n", false],
])("handles legacy and malformed manifests: %s", async (manifest, reports) => {
  const assertion = reports ? assertRuleReports : assertRuleDoesNotReport;
  await expect(
    assertion(ruleName, "export const run = () => process.env.MODE;\n", {
      filename,
      files: { "extensions/discount/shopify.extension.toml": manifest },
    }),
  ).resolves.toBeUndefined();
});
