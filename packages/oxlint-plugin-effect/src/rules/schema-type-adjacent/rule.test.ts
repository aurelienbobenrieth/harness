import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/schema-type-adjacent";

it("reports a blank line between a schema and its type alias", async () => {
  await expect(
    assertRuleReports(
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
