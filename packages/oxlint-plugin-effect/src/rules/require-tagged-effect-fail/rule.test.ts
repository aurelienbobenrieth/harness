import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/require-tagged-effect-fail";

it("reports string literal failures", async () => {
  await expect(assertRuleReports(ruleName, 'const program = Effect.fail("boom");\n')).resolves.toBeUndefined();
});

it("reports object literal failures", async () => {
  await expect(
    assertRuleReports(ruleName, 'const program = Effect.fail({ reason: "boom" });\n'),
  ).resolves.toBeUndefined();
});

it("reports array literal failures", async () => {
  await expect(assertRuleReports(ruleName, 'const program = Effect.fail(["boom"]);\n')).resolves.toBeUndefined();
});

it("reports template literal failures", async () => {
  await expect(assertRuleReports(ruleName, "const program = Effect.fail(`boom`);\n")).resolves.toBeUndefined();
});

it("allows constructed typed failures", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const program = Effect.fail(new DomainError({ reason }));\n"),
  ).resolves.toBeUndefined();
});

it("allows named typed failures", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const program = Effect.fail(error);\n")).resolves.toBeUndefined();
});

it("ignores non-Effect fail calls", async () => {
  await expect(assertRuleDoesNotReport(ruleName, 'const program = Result.fail("boom");\n')).resolves.toBeUndefined();
});

it("reports same-file untagged Error subclasses", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'class UserMissing extends Error {}\nconst program = Effect.fail(new UserMissing("missing"));\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports transitive same-file Error subclasses", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "class BaseFailure extends Error {}\nclass UserMissing extends BaseFailure {}\nconst program = Effect.fail(new UserMissing());\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports native errors beyond Error, TypeError and RangeError", async () => {
  await expect(
    assertRuleReports(ruleName, 'const program = Effect.fail(new SyntaxError("bad"));\n'),
  ).resolves.toBeUndefined();
});

it("reports Effect.failSync producing a native Error", async () => {
  await expect(
    assertRuleReports(ruleName, 'const program = Effect.failSync(() => new Error("boom"));\n'),
  ).resolves.toBeUndefined();
});

it("allows same-file Error subclasses that declare a _tag", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'class UserMissing extends Error { readonly _tag = "UserMissing"; }\nconst program = Effect.fail(new UserMissing());\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows same-file tagged error classes", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'class UserMissing extends Data.TaggedError("UserMissing")<{}> {}\nconst program = Effect.fail(new UserMissing());\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows Effect.failSync producing an imported domain error", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { UserMissing } from "./errors";\nconst program = Effect.failSync(() => new UserMissing());\n',
    ),
  ).resolves.toBeUndefined();
});

it("skips test files by default and reports once allow is replaced", async () => {
  await expect(
    assertRuleDoesNotReport("effect/require-tagged-effect-fail", "const p = Effect.fail('boom');\n", {
      filename: "src/store.test.ts",
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports("effect/require-tagged-effect-fail", "const p = Effect.fail('boom');\n", {
      filename: "src/store.test.ts",
      ruleOptions: { allow: ["**/nothing/**"] },
    }),
  ).resolves.toBeUndefined();
});

it("accepts a literal _tag under as const or satisfies", async () => {
  await expect(
    assertRuleDoesNotReport(
      "effect/require-tagged-effect-fail",
      [
        'const a = Effect.fail({ _tag: "CreateAccountInProgress" as const });',
        'const b = Effect.fail({ _tag: "Pending" } as const);',
        'const c = Effect.fail({ _tag: "Pending" } satisfies Failure);',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("still reports an object without a literal _tag under a type assertion", async () => {
  await expect(
    assertRuleReports("effect/require-tagged-effect-fail", 'const a = Effect.fail({ code: "X" } as const);\n'),
  ).resolves.toBeUndefined();
});
