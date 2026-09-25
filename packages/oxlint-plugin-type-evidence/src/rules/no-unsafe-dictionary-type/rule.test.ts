import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/no-unsafe-dictionary-type";

it("reports Record with string keys and unknown values", async () => {
  await expect(assertRuleReports(ruleName, "type Dict = Record<string, unknown>;\n")).resolves.toBeUndefined();
});

it("reports Record with number keys and any values", async () => {
  await expect(assertRuleReports(ruleName, "type Dict = Record<number, any>;\n")).resolves.toBeUndefined();
});

it("reports Record with PropertyKey keys and object values", async () => {
  await expect(assertRuleReports(ruleName, "type Dict = Record<PropertyKey, object>;\n")).resolves.toBeUndefined();
});

it("reports Record with broad union keys and empty object values", async () => {
  await expect(assertRuleReports(ruleName, 'type Dict = Record<string | "id", {}>;\n')).resolves.toBeUndefined();
});

it("reports open index signatures with unknown values", async () => {
  await expect(assertRuleReports(ruleName, "type Dict = { [key: string]: unknown };\n")).resolves.toBeUndefined();
});

it("reports index signatures with unknown values inside interfaces", async () => {
  await expect(assertRuleReports(ruleName, "interface Bag {\n  [key: string]: unknown;\n}\n")).resolves.toBeUndefined();
});

it("reports mapped types over broad keys with unknown values", async () => {
  await expect(assertRuleReports(ruleName, "type Dict = { [key in string]: unknown };\n")).resolves.toBeUndefined();
});

it("reports dictionaries assembled from same-file aliases", async () => {
  await expect(
    assertRuleReports(ruleName, "type Key = string;\ntype Value = unknown;\ntype Dict = Record<Key, Value>;\n"),
  ).resolves.toBeUndefined();
});

it("allows Record with contract-bearing values", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "type Commands = Record<string, Command>;\n"),
  ).resolves.toBeUndefined();
});

it("allows Record over finite key unions", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'type Flags = Record<"draft" | "live", boolean>;\n'),
  ).resolves.toBeUndefined();
});

it("allows exhaustive mapped types over finite unions", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'type Status = "on" | "off";\ntype StatusFlags = { [K in Status]: boolean };\n'),
  ).resolves.toBeUndefined();
});

it("allows unknown nested inside the value shape", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "type Events = Record<string, { payload: unknown }>;\n"),
  ).resolves.toBeUndefined();
});

it("allows Map and WeakMap types", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "type Cache = Map<string, unknown>;\ntype Refs = WeakMap<object, unknown>;\n"),
  ).resolves.toBeUndefined();
});

it("allows dictionaries inside type parameter constraints", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "function merge<T extends Record<string, unknown>>(input: T) { return input; }\n",
    ),
  ).resolves.toBeUndefined();
});
