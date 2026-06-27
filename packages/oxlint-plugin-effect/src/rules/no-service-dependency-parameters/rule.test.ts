import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-service-dependency-parameters";

it("reports service-named parameters", async () => {
  await expect(
    assertRuleReports(ruleName, "const run = (emailService: EmailService) => Effect.void;\n"),
  ).resolves.toBeUndefined();
});

it("allows non-service parameters", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const run = (userId: UserId) => Effect.void;\n"),
  ).resolves.toBeUndefined();
});

it("allows yielding services from context", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const run = Effect.gen(function* () { const store = yield* UserStore; });\n"),
  ).resolves.toBeUndefined();
});

it("ignores service examples in template strings", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const example = `const run = (emailService: EmailService) => Effect.void`;\n"),
  ).resolves.toBeUndefined();
});
