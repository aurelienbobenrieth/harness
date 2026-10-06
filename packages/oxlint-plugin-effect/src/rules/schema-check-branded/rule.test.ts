import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "effect/schema-check-branded";
const domainFile = { filename: "packages/jobs/src/jobs/_/domain/families.ts" };

it("reports a checked schema without a brand", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "export const Concurrency = Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1)));\n",
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("reports a check written as a method", async () => {
  await expect(
    assertRuleReports(ruleName, "const Name = Schema.String.check(Schema.isMaxLength(80));\n", domainFile),
  ).resolves.toBeUndefined();
});

it("reports an unbranded checked field of a struct", async () => {
  await expect(
    reportedMessages(
      ruleName,
      "export const Job = Schema.Struct({ maxAttempts: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))) });\n",
      domainFile,
    ),
  ).resolves.toStrictEqual([
    'Brand this checked schema (`Schema.brand("...")`): without a brand its type is the unchecked one, so code can build a value the check refuses.',
  ]);
});

it("allows a check branded in the same pipe", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'export const Concurrency = Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1)), Schema.brand("Concurrency"));\n',
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows a check branded further down the chain", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `const A = Schema.String.check(Schema.isMaxLength(80)).pipe(Schema.brand("A"));
const B = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))).annotate({}).pipe(Schema.brand("B"));
`,
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows the built-in refined schemas used as they are", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "export const Count = Schema.Struct({ n: Schema.Int, name: Schema.NonEmptyString, rate: Schema.Finite });\n",
      domainFile,
    ),
  ).resolves.toBeUndefined();
});

it("ignores a check outside domain folders by default", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const Limit = Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 9 })));\n",
      {
        filename: "packages/contracts/src/paging.ts",
      },
    ),
  ).resolves.toBeUndefined();
});

it("checks the files a configuration names", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const Limit = Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 9 })));\n",
      {
        filename: "packages/kernel/src/paging.ts",
        ruleOptions: { files: ["**/packages/kernel/**"] },
      },
    ),
  ).resolves.toBeUndefined();
});
