import { test } from "node:test";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-raw-json-parse";

test("reports raw JSON.parse", async () => {
  await assertRuleReports(ruleName, "const value = JSON.parse(input);\n");
});

test("allows non-JSON.parse parsing helpers", async () => {
  await assertRuleDoesNotReport(ruleName, "const value = Schema.decodeUnknownSync(ConfigFromJson)(input);\n");
});

test("allows immediate Effect-style decoder wrappers", async () => {
  await assertRuleDoesNotReport(ruleName, "const value = ConfigDecoder(JSON.parse(input));\n");
});
