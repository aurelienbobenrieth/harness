import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-mutable-exported-state";

it("reports exported let bindings", async () => {
  await expect(assertRuleReports(ruleName, "export let currentUserId = undefined;\n")).resolves.toBeUndefined();
});

it("reports exported object literals", async () => {
  await expect(assertRuleReports(ruleName, "export const state = { ready: false };\n")).resolves.toBeUndefined();
});

it("reports exported array literals", async () => {
  await expect(assertRuleReports(ruleName, "export const queue = [];\n")).resolves.toBeUndefined();
});

it("reports exported mutable constructor instances", async () => {
  await expect(assertRuleReports(ruleName, "export const cache = new Map();\n")).resolves.toBeUndefined();
});

it("reports mutable bindings exported later", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `
const cache = new Map();
export { cache };
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports aliased mutable bindings exported later", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `
const cache = {};
export { cache as sharedCache };
`,
    ),
  ).resolves.toBeUndefined();
});

it("allows exported primitive constants", async () => {
  await expect(assertRuleDoesNotReport(ruleName, 'export const serviceName = "billing";\n')).resolves.toBeUndefined();
});

it("allows exported factories", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export const makeCache = () => new Map();\n"),
  ).resolves.toBeUndefined();
});

it("allows local mutable state that is not exported", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const cache = new Map();\n")).resolves.toBeUndefined();
});

it("accepts regression: function local() { const state = {}; return state; } const state = 1; export { state, local };", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    "function local() { const state = {}; return state; } const state = 1; export { state, local };",
  );
});

it("reports regression: export { state }; const state = {};", async () => {
  await assertRuleReports(ruleName, "export { state }; const state = {};");
});

it("allows exported collections annotated as readonly", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "export const names: readonly string[] = [];",
        "export const pair: readonly [number, number] = [1, 2];",
        "export const labels: Readonly<Record<string, string>> = { a: 'A' };",
        "export const ids: ReadonlyArray<number> = [1];",
        "export const lookup: ReadonlyMap<string, number> = new Map();",
        "export const seen: ReadonlySet<string> = new Set();",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("still reports collections annotated with mutable types", async () => {
  await expect(
    assertRuleReports(ruleName, "export const labels: Record<string, string> = { a: 'A' };\n"),
  ).resolves.toBeUndefined();
});

it("allows a readonly-annotated collection exported later", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const names: readonly string[] = [];\nexport { names };\n"),
  ).resolves.toBeUndefined();
});
