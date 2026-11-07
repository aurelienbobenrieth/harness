import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-service-option";

it("reports Effect.serviceOption calls", async () => {
  await expect(
    assertRuleReports(ruleName, "const maybeRepo = Effect.serviceOption(UserRepo);\n"),
  ).resolves.toBeUndefined();
});

it("reports computed Effect.serviceOption calls", async () => {
  await expect(
    assertRuleReports(ruleName, 'const maybeRepo = Effect["serviceOption"](UserRepo);\n'),
  ).resolves.toBeUndefined();
});

it("allows Effect.service calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const repo = Effect.service(UserRepo);\n")).resolves.toBeUndefined();
});

it("allows serviceOption calls on other namespaces", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const maybeRepo = Context.serviceOption(UserRepo);\n"),
  ).resolves.toBeUndefined();
});

it("reports serviceOption through an aliased import", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { Effect as E } from "effect";\nconst cache = E.serviceOption(Cache);\n'),
  ).resolves.toBeUndefined();
});

it("ignores serviceOption on a local object shadowing Effect", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const Effect = { serviceOption: (tag: unknown) => tag };\nconst cache = Effect.serviceOption(Cache);\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows the ambient ParentSpan service by default", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const parent = Effect.serviceOption(Tracer.ParentSpan);\nconst bare = Effect.serviceOption(ParentSpan);\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows the services named in allowedServices on top of ParentSpan and reports the rest", async () => {
  const options = { ruleOptions: { allowedServices: ["SqlTransaction"] } };
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const tx = Effect.serviceOption(Client.SqlTransaction);\nconst parent = Effect.serviceOption(Tracer.ParentSpan);\n",
      options,
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const mail = Effect.serviceOption(Mailer);\n", options),
  ).resolves.toBeUndefined();
});
