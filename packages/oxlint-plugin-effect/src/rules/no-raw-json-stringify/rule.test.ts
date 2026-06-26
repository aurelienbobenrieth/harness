import { expect, test } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-raw-json-stringify";

test("reports raw JSON.stringify", async () => {
  await expect(assertRuleReports(ruleName, "const value = JSON.stringify(input);\n")).resolves.toBeUndefined();
});

test("allows Effect Schema JSON encoders", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const value = Schema.encodeUnknownSync(Schema.fromJsonString(ConfigSchema))(input);\n",
    ),
  ).resolves.toBeUndefined();
});
