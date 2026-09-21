import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/schema-type-adjacent";

it("allows formatting whitespace between a schema and its type alias", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export const User = Schema.Struct({
  id: Schema.String,
});

export type User = typeof User.Type;
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports logic between a schema and its type alias", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `export const User = Schema.Struct({
  id: Schema.String,
});
const userKey = "user";
export type User = typeof User.Type;
`,
    ),
  ).resolves.toBeUndefined();
});

it("allows an adjacent schema type alias", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export const User = Schema.Struct({
  id: Schema.String,
});
export type User = typeof User.Type;
`,
    ),
  ).resolves.toBeUndefined();
});

it("allows an adjacent encoded schema type alias", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export const User = Schema.Struct({
  id: Schema.String,
});
export type User = typeof User.Encoded;
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores unrelated type aliases", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export const User = Schema.Struct({
  id: Schema.String,
});

export type UserInput = typeof User.Type;
`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts regression: const User = Schema.Struct({id: Schema.String}); /** Public contract. */ export type User = Schema.Schema.Type<typeof User>;", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    "const User = Schema.Struct({id: Schema.String}); /** Public contract. */ export type User = Schema.Schema.Type<typeof User>;",
  );
});

it("reports separated aliases for schemas built through an aliased Schema import", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { Schema as S } from "effect";\nexport const User = S.Struct({ id: S.String });\nconst unrelated = 1;\nexport type User = typeof User.Type;\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores values built by a local object shadowing Schema", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const Schema = { Struct: (fields: unknown) => ({ Type: fields }) };\nexport const User = Schema.Struct({ id: 1 });\nconst unrelated = 1;\nexport type User = typeof User.Type;\n",
    ),
  ).resolves.toBeUndefined();
});
