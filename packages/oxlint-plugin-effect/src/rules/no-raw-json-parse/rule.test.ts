import { expect, test } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-raw-json-parse";

test("reports raw JSON.parse", async () => {
  await expect(assertRuleReports(ruleName, "const value = JSON.parse(input);\n")).resolves.toBeUndefined();
});

test("allows non-JSON.parse parsing helpers", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const value = Schema.decodeUnknownSync(ConfigFromJson)(input);\n"),
  ).resolves.toBeUndefined();
});

test("allows immediate Effect-style decoder wrappers", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const value = ConfigDecoder(JSON.parse(input));\n"),
  ).resolves.toBeUndefined();
});
