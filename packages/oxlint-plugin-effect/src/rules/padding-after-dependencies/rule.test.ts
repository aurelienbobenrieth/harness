import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, fixCode, reportedMessages } from "../test-support.ts";

const ruleName = "effect/padding-after-dependencies";

describe("reports and pads", () => {
  it("reports dependencies glued to the logic below with the rule's message", async () => {
    await expect(
      assertRuleReports(
        ruleName,
        "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n  const user = yield* repo.findUser(id);\n  return user;\n});\n",
        { message: /Separate the service dependencies from the logic below them with a blank line\./ },
      ),
    ).resolves.toBeUndefined();
  });

  it("pads after the last dependency of an Effect.gen body", async () => {
    await expect(
      fixCode(
        ruleName,
        "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n  const clock = yield* Effect.service(Clock);\n  const user = yield* repo.findUser(id);\n  return user;\n});\n",
      ),
    ).resolves.toBe(
      "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n  const clock = yield* Effect.service(Clock);\n\n  const user = yield* repo.findUser(id);\n  return user;\n});\n",
    );
  });

  it('pads a named Effect.fn("name") body', async () => {
    await expect(
      fixCode(
        ruleName,
        'const load = Effect.fn("load")(function* (id: string) {\n  const repo = yield* UserRepo;\n  return yield* repo.findUser(id);\n});\n',
      ),
    ).resolves.toBe(
      'const load = Effect.fn("load")(function* (id: string) {\n  const repo = yield* UserRepo;\n\n  return yield* repo.findUser(id);\n});\n',
    );
  });

  it("keeps a trailing comment on the last dependency", async () => {
    await expect(
      fixCode(
        ruleName,
        "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo; // primary store\n  yield* repo.warm();\n});\n",
      ),
    ).resolves.toBe(
      "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo; // primary store\n\n  yield* repo.warm();\n});\n",
    );
  });

  it("puts the blank line above the comment that leads the logic", async () => {
    await expect(
      fixCode(
        ruleName,
        "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n  // Warm the cache first.\n  yield* repo.warm();\n});\n",
      ),
    ).resolves.toBe(
      "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n\n  // Warm the cache first.\n  yield* repo.warm();\n});\n",
    );
  });

  it("pads with CRLF in a CRLF file", async () => {
    await expect(
      fixCode(
        ruleName,
        "const program = Effect.gen(function* () {\r\n  const repo = yield* UserRepo;\r\n  yield* repo.warm();\r\n});\r\n",
      ),
    ).resolves.toBe(
      "const program = Effect.gen(function* () {\r\n  const repo = yield* UserRepo;\r\n\r\n  yield* repo.warm();\r\n});\r\n",
    );
  });

  it("reaches a fixed point after one pass", async () => {
    const once = await fixCode(
      ruleName,
      "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n  yield* repo.warm();\n});\n",
    );
    await expect(fixCode(ruleName, once)).resolves.toBe(once);
  });
});

describe("stays silent", () => {
  it.each([
    [
      "padded dependencies, with none between them",
      "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n  const clock = yield* Clock;\n\n  return yield* repo.findUser(id);\n});\n",
    ],
    [
      "a body of only dependencies",
      "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n  const clock = yield* Clock;\n});\n",
    ],
    [
      "a body without dependencies",
      "const program = Effect.gen(function* () {\n  const user = yield* repo.findUser(id);\n  return user;\n});\n",
    ],
    [
      "a dependency yielded after logic (dependencies-first owns it)",
      "const program = Effect.gen(function* () {\n  const user = yield* repo.findUser(id);\n  const repo = yield* UserRepo;\n  return user;\n});\n",
    ],
    [
      "a padded dependency run above a comment",
      "const program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n\n  // Warm the cache first.\n  yield* repo.warm();\n});\n",
    ],
    [
      "a non-Effect generator",
      "const program = Other.gen(function* () {\n  const repo = yield* UserRepo;\n  return yield* repo.findUser(id);\n});\n",
    ],
    [
      "an Effect.gen whose Effect is a local shadow",
      "const Effect = { gen: (body) => body };\nconst program = Effect.gen(function* () {\n  const repo = yield* UserRepo;\n  return yield* repo.findUser(id);\n});\n",
    ],
  ])("%s", async (_name, code) => {
    await expect(assertRuleDoesNotReport(ruleName, code)).resolves.toBeUndefined();
  });
});

const gluedBody = "  const repo = yield* UserRepo;\n  yield* repo.warm();\n";
const paddedBody = "  const repo = yield* UserRepo;\n\n  yield* repo.warm();\n";

describe("named imports from effect/Effect", () => {
  it.each([
    ["an aliased gen", 'import { gen as g } from "effect/Effect";\nconst program = g(function* () {'],
    ["fn", 'import { fn } from "effect/Effect";\nconst run = fn("run")(function* () {'],
    ["fnUntraced", 'import { fnUntraced } from "effect/Effect";\nconst run = fnUntraced(function* () {'],
    ["fnUntracedEager", 'import { fnUntracedEager } from "effect/Effect";\nconst run = fnUntracedEager(function* () {'],
  ])("pads a body passed to %s", async (_name, head) => {
    await expect(fixCode(ruleName, `${head}\n${gluedBody}});\n`)).resolves.toBe(`${head}\n${paddedBody}});\n`);
  });

  it("ignores a body passed to a same-named local gen", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        `const gen = (body: unknown) => body;\nconst program = gen(function* () {\n${gluedBody}});\n`,
      ),
    ).resolves.toBeUndefined();
  });
});

describe("generator bodies passed by reference", () => {
  it("pads a function declaration passed to Effect.gen twice, reporting once", async () => {
    const uses = "export const a = Effect.gen(program);\nexport const b = Effect.gen(program);\n";
    await expect(reportedMessages(ruleName, `function* program() {\n${gluedBody}}\n${uses}`)).resolves.toHaveLength(1);
    await expect(fixCode(ruleName, `function* program() {\n${gluedBody}}\n${uses}`)).resolves.toBe(
      `function* program() {\n${paddedBody}}\n${uses}`,
    );
  });

  it('pads a const generator expression passed to Effect.fn("run")', async () => {
    const use = 'export const run = Effect.fn("run")(program);\n';
    await expect(fixCode(ruleName, `const program = function* () {\n${gluedBody}};\n${use}`)).resolves.toBe(
      `const program = function* () {\n${paddedBody}};\n${use}`,
    );
  });

  it.each([
    [
      "a declaration passed only to a non-Effect constructor",
      `function* program() {\n${gluedBody}}\nexport const run = Other.gen(program);\n`,
    ],
    [
      "a declaration whose name is shadowed where Effect.gen receives it",
      `function* program() {\n${gluedBody}}\nexport function wrap(program: unknown) {\n  return Effect.gen(program);\n}\n`,
    ],
  ])("ignores %s", async (_name, code) => {
    await expect(assertRuleDoesNotReport(ruleName, code)).resolves.toBeUndefined();
  });
});
