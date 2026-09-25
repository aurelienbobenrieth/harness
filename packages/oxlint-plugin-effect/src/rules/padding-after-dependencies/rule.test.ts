import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, fixCode } from "../test-support.ts";

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
