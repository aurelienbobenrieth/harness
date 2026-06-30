import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/prefer-schema-decode-unknown";

it("reports Schema.decodeSync on JSON.parse input", async () => {
  await expect(
    assertRuleReports(ruleName, "const user = Schema.decodeSync(UserSchema)(JSON.parse(raw));\n"),
  ).resolves.toBeUndefined();
});

it("reports Schema.decode on JSON.parse input", async () => {
  await expect(
    assertRuleReports(ruleName, "const user = yield* Schema.decode(UserSchema)(JSON.parse(raw));\n"),
  ).resolves.toBeUndefined();
});

it("reports Schema.decodeEither on values cast to unknown", async () => {
  await expect(
    assertRuleReports(ruleName, "const user = Schema.decodeEither(UserSchema)(payload as unknown);\n"),
  ).resolves.toBeUndefined();
});

it("reports Schema.decodePromise on values cast to any", async () => {
  await expect(
    assertRuleReports(ruleName, "const user = Schema.decodePromise(UserSchema)(payload as any);\n"),
  ).resolves.toBeUndefined();
});

it("allows decodeUnknown variants for JSON.parse input", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const user = Schema.decodeUnknownSync(UserSchema)(JSON.parse(raw));\n"),
  ).resolves.toBeUndefined();
});

it("allows normal decode for typed encoded values", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const user = Schema.decodeSync(UserSchema)(encodedUser);\n"),
  ).resolves.toBeUndefined();
});

it("ignores examples in strings", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const example = `Schema.decodeSync(UserSchema)(JSON.parse(raw))`;\n"),
  ).resolves.toBeUndefined();
});
