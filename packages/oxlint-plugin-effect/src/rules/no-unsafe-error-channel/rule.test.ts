import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-unsafe-error-channel";

it("reports unknown in the Effect error channel", async () => {
  await expect(
    assertRuleReports(ruleName, "type Program = Effect.Effect<void, unknown, Config>;\n"),
  ).resolves.toBeUndefined();
});

it("reports any in the Effect error channel", async () => {
  await expect(
    assertRuleReports(ruleName, "type Program = Effect.Effect<void, any, Config>;\n"),
  ).resolves.toBeUndefined();
});

it("reports multiline unsafe Effect error channels", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `type Program = Effect.Effect<
  ReadonlyArray<string>,
  unknown,
  Config
>;\n`,
    ),
  ).resolves.toBeUndefined();
});

it("allows never in the Effect error channel", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "type Program = Effect.Effect<void, never, Config>;\n"),
  ).resolves.toBeUndefined();
});

it("allows typed errors in the Effect error channel", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "type Program = Effect.Effect<void, DomainError | InfraError, Config>;\n"),
  ).resolves.toBeUndefined();
});

it("allows unknown outside the Effect error channel", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "type Program = Effect.Effect<unknown, DomainError, Config>;\n"),
  ).resolves.toBeUndefined();
});

it("allows any outside the Effect error channel", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "type Program = Effect.Effect<any, DomainError, Config>;\n"),
  ).resolves.toBeUndefined();
});

it("ignores unsafe examples in strings", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const example = "type Program = Effect.Effect<void, unknown, Config>;";\n'),
  ).resolves.toBeUndefined();
});

it("ignores unsafe examples in comments", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "// type Program = Effect.Effect<void, any, Config>;\n"),
  ).resolves.toBeUndefined();
});
