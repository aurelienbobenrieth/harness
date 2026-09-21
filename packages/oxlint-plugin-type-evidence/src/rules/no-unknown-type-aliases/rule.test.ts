import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/no-unknown-type-aliases";

it("reports aliases of unknown", async () => {
  await expect(assertRuleReports(ruleName, "type Data = unknown;\n")).resolves.toBeUndefined();
});

it("reports parenthesized unknown aliases", async () => {
  await expect(assertRuleReports(ruleName, "type Data = (unknown);\n")).resolves.toBeUndefined();
});

it("reports unions that collapse to unknown", async () => {
  await expect(assertRuleReports(ruleName, "type Data = unknown | string;\n")).resolves.toBeUndefined();
});

it("reports transitive aliases of unknown", async () => {
  await expect(assertRuleReports(ruleName, "type Inner = unknown;\ntype Outer = Inner;\n")).resolves.toBeUndefined();
});

it("allows unknown nested inside generic arguments", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "type Box<T> = { value: T };\ntype Payload = Box<unknown>;\n"),
  ).resolves.toBeUndefined();
});

it("allows concrete aliases", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "type Data = { id: string };\n")).resolves.toBeUndefined();
});

it("allows circular aliases without hanging", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "type A = B;\ntype B = A;\n")).resolves.toBeUndefined();
});
