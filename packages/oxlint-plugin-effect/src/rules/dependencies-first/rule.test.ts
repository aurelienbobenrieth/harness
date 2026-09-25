import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

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

const lateBody = "  const user = yield* repo.findUser(id);\n  const repo = yield* UserRepo;\n  return user;\n";

describe("named imports from effect/Effect", () => {
  it.each([
    ["gen", 'import { gen } from "effect/Effect";\nconst program = gen(function* () {'],
    ["an aliased gen", 'import { gen as g } from "effect/Effect";\nconst program = g(function* () {'],
    ["fn", 'import { fn } from "effect/Effect";\nconst run = fn("run")(function* () {'],
    ["fnUntraced", 'import { fnUntraced } from "effect/Effect";\nconst run = fnUntraced(function* () {'],
    ["fnUntracedEager", 'import { fnUntracedEager } from "effect/Effect";\nconst run = fnUntracedEager(function* () {'],
  ])("reports late dependencies through %s", async (_name, head) => {
    await expect(assertRuleReports(ruleName, `${head}\n${lateBody}});\n`)).resolves.toBeUndefined();
  });

  it.each([
    ["a same-named local gen", "const gen = (body: unknown) => body;\nconst program = gen(function* () {"],
    ["gen imported from another module", 'import { gen } from "other";\nconst program = gen(function* () {'],
  ])("ignores %s", async (_name, head) => {
    await expect(assertRuleDoesNotReport(ruleName, `${head}\n${lateBody}});\n`)).resolves.toBeUndefined();
  });
});

describe("generator bodies passed by reference", () => {
  it("reports a function declaration passed to Effect.gen twice only once", async () => {
    await expect(
      reportedMessages(
        ruleName,
        `function* program() {\n${lateBody}}\nexport const a = Effect.gen(program);\nexport const b = Effect.gen(program);\n`,
      ),
    ).resolves.toHaveLength(1);
  });

  it.each([
    [
      'a const generator expression passed to Effect.fn("run")',
      `const program = function* () {\n${lateBody}};\nexport const run = Effect.fn("run")(program);\n`,
    ],
    [
      "a declaration passed to a named gen import",
      `import { gen } from "effect/Effect";\nfunction* program() {\n${lateBody}}\nexport const run = gen(program);\n`,
    ],
  ])("reports %s", async (_name, code) => {
    await expect(assertRuleReports(ruleName, code)).resolves.toBeUndefined();
  });

  it.each([
    [
      "a declaration passed only to a non-Effect constructor",
      `function* program() {\n${lateBody}}\nexport const run = Other.gen(program);\n`,
    ],
    [
      "a declaration whose name is shadowed where Effect.gen receives it",
      `function* program() {\n${lateBody}}\nexport function wrap(program: unknown) {\n  return Effect.gen(program);\n}\n`,
    ],
  ])("ignores %s", async (_name, code) => {
    await expect(assertRuleDoesNotReport(ruleName, code)).resolves.toBeUndefined();
  });
});
