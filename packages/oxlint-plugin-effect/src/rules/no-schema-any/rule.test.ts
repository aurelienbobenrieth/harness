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
      ruleOptions: { allow: ["**/legacy/**"] },
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

it("reports Schema.Any through an aliased import", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { Schema as S } from "effect";\nconst Payload = S.Struct({ value: S.Any });\n',
      { filename: "apps/backend/src/features/example.ts" },
    ),
  ).resolves.toBeUndefined();
});

it("ignores Any on a local object shadowing Schema", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const Schema = { Any: 1 };\nconst value = Schema.Any;\n", {
      filename: "apps/backend/src/features/example.ts",
    }),
  ).resolves.toBeUndefined();
});
