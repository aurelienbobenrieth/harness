import { test } from "node:test";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-raw-json-stringify";

test("reports raw JSON.stringify", async () => {
  await assertRuleReports(ruleName, "const value = JSON.stringify(input);\n");
});

test("allows Effect Schema JSON encoders", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    "const value = Schema.encodeUnknownSync(Schema.fromJsonString(ConfigSchema))(input);\n",
  );
});
