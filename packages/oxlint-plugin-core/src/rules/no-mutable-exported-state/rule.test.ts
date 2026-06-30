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
