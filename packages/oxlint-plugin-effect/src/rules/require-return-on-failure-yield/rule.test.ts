import { expect, it } from "vitest";
import { fixCode } from "../sota-test-support.ts";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/require-return-on-failure-yield";

it("reports a yielded Effect.fail statement", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const program = Effect.gen(function* () { if (!user) { yield* Effect.fail(new NotFound()); } return user.name; });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports a yielded same-file tagged error instance", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      [
        'class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}',
        'const load = Effect.fn("load")(function* (id: string) { if (!id) yield* new Missing(); return id; });',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("reports imported classes named like errors and Effect.never", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { UserNotFoundError } from "./errors";\nconst p = Effect.gen(function* () { yield* new UserNotFoundError(); });\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const p = Effect.gen(function* () { yield* Effect.never; });\n"),
  ).resolves.toBeUndefined();
});

it("allows returned failures and yields that can succeed", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "class Job extends Data.Class<{ readonly id: string }> {}",
        'import { Mailer } from "./mailer";',
        "const p = Effect.gen(function* () {",
        "  if (!user) return yield* Effect.fail(new NotFound());",
        "  yield* Effect.log('ok');",
        "  yield* new Job({ id: '1' });",
        "  yield* new Mailer();",
        "  yield* Effect.fail(new NotFound()).pipe(Effect.catch(() => Effect.void));",
        "});",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("ignores failing yields outside Effect generators", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function* saga() { yield* Effect.fail(new NotFound()); }\n"),
  ).resolves.toBeUndefined();
});

it("prepends return", async () => {
  await expect(
    fixCode(ruleName, "const p = Effect.gen(function* () { if (!user) { yield* Effect.fail(new NotFound()); } });\n"),
  ).resolves.toBe(
    "const p = Effect.gen(function* () { if (!user) { return yield* Effect.fail(new NotFound()); } });\n",
  );
});
