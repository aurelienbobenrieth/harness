import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/no-unknown-parameters";

it("reports parameters annotated as unknown", async () => {
  await expect(
    assertRuleReports(ruleName, "function parse(value: unknown) { return value; }\n"),
  ).resolves.toBeUndefined();
});

it("reports unknown inside union annotations", async () => {
  await expect(
    assertRuleReports(ruleName, "function parse(value: string | unknown) { return value; }\n"),
  ).resolves.toBeUndefined();
});

it("reports unknown parameters on arrow functions", async () => {
  await expect(assertRuleReports(ruleName, "const parse = (value: unknown) => value;\n")).resolves.toBeUndefined();
});

it("reports unknown parameters in interface method signatures", async () => {
  await expect(
    assertRuleReports(ruleName, "interface Parser {\n  parse(value: unknown): string;\n}\n"),
  ).resolves.toBeUndefined();
});

it("reports unknown parameters that are not the type guard subject", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "function isUser(value: unknown, context: unknown): value is User { return context !== null; }\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows a parameter named cause", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'function wrap(cause: unknown) { return new Error("wrapped", { cause }); }\n'),
  ).resolves.toBeUndefined();
});

it("allows the subject of a type predicate", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function isUser(value: unknown): value is User { return value !== null; }\n"),
  ).resolves.toBeUndefined();
});

it("allows the subject of an assertion predicate", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function assertDefined(value: unknown): asserts value {}\n"),
  ).resolves.toBeUndefined();
});

it("allows named domain types", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function parse(value: RawInput) { return value; }\n"),
  ).resolves.toBeUndefined();
});
