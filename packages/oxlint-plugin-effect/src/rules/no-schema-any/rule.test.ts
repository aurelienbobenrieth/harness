import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-schema-any";

it("reports Schema.Any in source files", async () => {
  await expect(
    assertRuleReports(ruleName, "const Payload = Schema.Any;\n", {
      filename: "packages/core/src/payload.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows Schema.Unknown in source files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const Payload = Schema.Unknown;\n", {
      filename: "packages/core/src/payload.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows Schema.Any in test files by default", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const Payload = Schema.Any;\n", {
      filename: "packages/core/src/payload.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows Schema.Any in fixture files by default", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const Payload = Schema.Any;\n", {
      filename: "packages/core/fixtures/payload.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows configured escape-hatch files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const Payload = Schema.Any;\n", {
      filename: "packages/core/src/legacy/payload.ts",
      ruleConfig: ["error", { allow: ["**/legacy/**"] }],
    }),
  ).resolves.toBeUndefined();
});

it("ignores non-Schema Any members", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const Payload = Other.Any;\n", {
      filename: "packages/core/src/payload.ts",
    }),
  ).resolves.toBeUndefined();
});
