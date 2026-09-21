import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-raw-json-parse";

it("reports raw JSON.parse", async () => {
  await expect(assertRuleReports(ruleName, "const value = JSON.parse(input);\n")).resolves.toBeUndefined();
});

it("allows non-JSON.parse parsing helpers", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const value = Schema.decodeUnknownSync(ConfigFromJson)(input);\n"),
  ).resolves.toBeUndefined();
});

it("rejects decoder names without Schema provenance", async () => {
  await expect(
    assertRuleReports(ruleName, "const value = ConfigDecoder(JSON.parse(input));\n"),
  ).resolves.toBeUndefined();
});

it("allows an aliased Schema decoder around JSON.parse", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Schema as S } from "effect";\nconst value = S.decodeUnknownSync(Config)(JSON.parse(input));\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows Schema.decodeUnknownEffect around JSON.parse", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const value = Schema.decodeUnknownEffect(Config)(JSON.parse(input));\n"),
  ).resolves.toBeUndefined();
});

it("rejects decoders of a local object shadowing Schema", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const Schema = { decodeUnknownSync: (schema: unknown) => (value: unknown) => value };\nconst value = Schema.decodeUnknownSync(Config)(JSON.parse(input));\n",
    ),
  ).resolves.toBeUndefined();
});
