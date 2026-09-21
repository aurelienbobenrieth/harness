import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/preserve-thrown-cause";

it("reports a catch mapper without parameters", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const query = Effect.tryPromise({ try: () => db.query(), catch: () => new DbError() });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports a catch mapper whose parameter is never read", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const parsed = Effect.try({ try: () => parse(input), catch: (_error) => new ParseError({ message: "bad input" }) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports method-shorthand mappers that shadow the parameter name elsewhere", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const cause = 1;\nconst query = Effect.tryPromise({ try: () => db.query(), catch(error) { return new DbError({ cause }); } });\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows mappers that keep the thrown value", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = Effect.tryPromise({ try: () => db.query(), catch: (cause) => new DbError({ cause }) });",
        "const b = Effect.try({ try: () => parse(input), catch: ({ message }: Error) => new ParseError({ message }) });",
        "const c = Effect.tryPromise({ try: () => db.query(), catch: toDbError });",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("leaves Effect.mapError and non-Effect try helpers alone", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = Effect.mapError(load, () => new NotFound());",
        "const b = Other.tryPromise({ try: () => db.query(), catch: () => new DbError() });",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});
