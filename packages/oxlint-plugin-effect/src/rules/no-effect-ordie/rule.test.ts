import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-effect-ordie";

it("reports Effect.orDie", async () => {
  await expect(assertRuleReports(ruleName, "const program = Effect.orDie(loadUser);\n")).resolves.toBeUndefined();
});

it("reports Effect.orDieWith", async () => {
  await expect(
    assertRuleReports(ruleName, "const program = Effect.orDieWith(loadUser, (error) => error);\n"),
  ).resolves.toBeUndefined();
});

it("allows non-Effect orDie calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const program = Other.orDie(loadUser);\n")).resolves.toBeUndefined();
});

it("allows configured files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const program = Effect.orDie(loadUser);\n", {
      filename: "test-fixtures/defects.ts",
      ruleOptions: { allow: ["**/test-fixtures/**"] },
    }),
  ).resolves.toBeUndefined();
});

it("allows configured call names", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const program = Effect.orDie(loadUser);\n", {
      ruleOptions: { allowedCalls: ["orDie"] },
    }),
  ).resolves.toBeUndefined();
});

it("reports Layer.orDie", async () => {
  await expect(assertRuleReports(ruleName, "const SafeLive = Layer.orDie(DatabaseLive);\n")).resolves.toBeUndefined();
});

it("reports an aliased Effect.orDie", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { Effect as E } from "effect";\nconst program = loadUser.pipe(E.orDie);\n'),
  ).resolves.toBeUndefined();
});

it("reports Effect.catch handlers that only die", async () => {
  await expect(
    assertRuleReports(ruleName, "const program = loadUser.pipe(Effect.catch((error) => Effect.die(error)));\n"),
  ).resolves.toBeUndefined();
});

it("reports Effect.catch handlers that return Effect.die", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const program = loadUser.pipe(Effect.catch((error) => { return Effect.die(error); }));\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports point-free Effect.catch(Effect.die)", async () => {
  await expect(
    assertRuleReports(ruleName, "const program = Effect.catch(loadUser, Effect.die);\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.catch handlers that map to a typed failure", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const program = loadUser.pipe(Effect.catch((cause) => Effect.fail(new UserLoadError({ cause }))));\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows Effect.catch handlers that do more than die", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const program = loadUser.pipe(Effect.catch((error) => Effect.logError(error).pipe(Effect.andThen(Effect.die(error)))));\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows configured Layer.orDie calls", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const SafeLive = Layer.orDie(DatabaseLive);\n", {
      ruleOptions: { allowedCalls: ["Layer.orDie"] },
    }),
  ).resolves.toBeUndefined();
});

it("ignores orDie on a local object shadowing Layer", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const Layer = { orDie: (value: unknown) => value };\nconst SafeLive = Layer.orDie(DatabaseLive);\n",
    ),
  ).resolves.toBeUndefined();
});
