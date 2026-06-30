import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-unsafe-error-mapper";

it("reports inline unknown Effect.mapError handlers", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const program = effect.pipe(Effect.mapError((error: unknown) => new DomainError()));\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports inline any Effect.catch handlers", async () => {
  await expect(
    assertRuleReports(ruleName, "const program = effect.pipe(Effect.catch((error: any) => Effect.fail(error)));\n"),
  ).resolves.toBeUndefined();
});

it("reports helper declarations passed to Effect.mapError", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const toError = (cause: unknown) => new DomainError();\nconst program = effect.pipe(Effect.mapError(toError));\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows typed mapper parameters", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const program = effect.pipe(Effect.mapError((error: InfraError) => new DomainError()));\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows unknown outside Effect error handlers", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const parse = (input: unknown) => String(input);\n"),
  ).resolves.toBeUndefined();
});

it("ignores string examples", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const example = "Effect.mapError((error: unknown) => error)";\n'),
  ).resolves.toBeUndefined();
});
