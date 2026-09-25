import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/dependencies-first";

it("reports dependency yields after logic", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `const program = Effect.gen(function* () {
  const user = yield* repo.findUser(id);
  const repo = yield* UserRepo;

  return user;
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("leaves blank line formatting alone after dependency yields", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `const program = Effect.gen(function* () {
  const repo = yield* UserRepo;
  const user = yield* repo.findUser(id);

  return user;
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("allows dependency yields before logic with one blank line", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `const program = Effect.gen(function* () {
  const repo = yield* UserRepo;
  const clock = yield* Effect.service(Clock);

  const user = yield* repo.findUser(id);
  return user;
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores yielded method calls", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `const program = Effect.gen(function* () {
  const user = yield* UserRepo.findUser(id);
  return user;
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("checks named Effect.fn generator bodies", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `const run = Effect.fn("run")(function* () {
  const user = yield* repo.findUser(id);
  const repo = yield* UserRepo;

  return user;
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores non Effect generators", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `const program = Other.gen(function* () {
  const user = yield* repo.findUser(id);
  const repo = yield* UserRepo;
  return user;
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("reports late dependencies inside Effect.fnUntraced", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const run = Effect.fnUntraced(function* (id: string) {\n  const user = yield* repo.findUser(id);\n  const repo = yield* UserRepo;\n  return user;\n});\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports late dependencies through an aliased Effect import", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { Effect as E } from "effect";\nconst run = E.gen(function* () {\n  const user = yield* repo.findUser(id);\n  const repo = yield* UserRepo;\n  return user;\n});\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows dependencies first inside Effect.fnUntraced", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const run = Effect.fnUntraced(function* (id: string) {\n  const repo = yield* UserRepo;\n  const user = yield* repo.findUser(id);\n  return user;\n});\n",
    ),
  ).resolves.toBeUndefined();
});
