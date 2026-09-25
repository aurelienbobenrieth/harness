import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/no-known-value-widening";

it("reports known object literals declared as unknown", async () => {
  await expect(assertRuleReports(ruleName, 'const state: unknown = { status: "idle" };\n')).resolves.toBeUndefined();
});

it("reports known object literals declared as object", async () => {
  await expect(assertRuleReports(ruleName, "const config: object = { retries: 3 };\n")).resolves.toBeUndefined();
});

it("reports non-empty literals declared as a broad Record", async () => {
  await expect(
    assertRuleReports(ruleName, "const lookup: Record<string, number> = { first: 1 };\n"),
  ).resolves.toBeUndefined();
});

it("reports known values in broadly annotated class properties", async () => {
  await expect(
    assertRuleReports(ruleName, "class Store {\n  state: object = { ready: true };\n}\n"),
  ).resolves.toBeUndefined();
});

it("reports assignments of known values to broadly declared variables", async () => {
  await expect(
    assertRuleReports(ruleName, 'let state: unknown;\nstate = { status: "idle" };\n'),
  ).resolves.toBeUndefined();
});

it("reports known returns from functions with broad return types", async () => {
  await expect(
    assertRuleReports(ruleName, "function build(): object { return { id: 1 }; }\n"),
  ).resolves.toBeUndefined();
});

it("reports asserting a known value to a broad type", async () => {
  await expect(assertRuleReports(ruleName, "const value = { id: 1 } as object;\n")).resolves.toBeUndefined();
});

it("reports empty object literals declared as unknown", async () => {
  await expect(assertRuleReports(ruleName, "const empty: unknown = {};\n")).resolves.toBeUndefined();
});

it("enforces corrected contract: reports known values pushed into anonymous type literals", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const user: { id: number } = { id: 1 };\n")).resolves.toBeUndefined();
});

it("allows empty object accumulators typed as an open Record", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const acc: Record<string, number> = {};\n")).resolves.toBeUndefined();
});

it("allows empty object accumulators typed with an index signature", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const acc: { [key: string]: number } = {};\n"),
  ).resolves.toBeUndefined();
});

it("allows inferred declarations", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const user = { id: 1 };\n")).resolves.toBeUndefined();
});

it("allows named owner contracts", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const user: User = { id: 1 };\n")).resolves.toBeUndefined();
});

it("allows broad annotations over values without known evidence", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const state: unknown = load();\n")).resolves.toBeUndefined();
});

it("allows satisfies without an annotation", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const user = { id: 1 } satisfies User;\n")).resolves.toBeUndefined();
});

it("accepts regression: const point: { x: number; y: number } = { x: 1, y: 2 };", async () => {
  await assertRuleDoesNotReport(ruleName, "const point: { x: number; y: number } = { x: 1, y: 2 };");
});
