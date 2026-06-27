import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-raw-json-stringify";

it("reports raw JSON.stringify", async () => {
  await expect(assertRuleReports(ruleName, "const value = JSON.stringify(input);\n")).resolves.toBeUndefined();
});

it("allows Effect Schema JSON encoders", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const value = Schema.encodeUnknownSync(Schema.fromJsonString(ConfigSchema))(input);\n",
    ),
  ).resolves.toBeUndefined();
});
