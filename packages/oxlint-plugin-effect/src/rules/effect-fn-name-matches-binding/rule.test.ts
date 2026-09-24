import { expect, it } from "vitest";
import { fixCode } from "../test-support.ts";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/effect-fn-name-matches-binding";

it("reports a span name copied from a sibling function", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const create = Effect.fn("TodoRepo.getById")(function* (id: string) { return id; });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports drift on object properties and class fields", async () => {
  await expect(
    assertRuleReports(ruleName, 'const repo = { create: Effect.fn("TodoRepo.remove")(function* () {}) };\n'),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, 'class Repo { readonly create = Effect.fn("Repo.remove")(function* () {}); }\n'),
  ).resolves.toBeUndefined();
});

it("allows any prefix as long as the last segment matches", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const create = Effect.fn("TodoRepo.create")(function* () {});',
        'const remove = Effect.fn("remove")(function* () {});',
        'const repo = { "find": Effect.fn("app.TodoRepo.find")(function* () {}) };',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("skips inline, computed, dynamic-name and non-Effect calls", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'register(Effect.fn("Http.createTodo")(function* () {}));',
        'const repo = { [key]: Effect.fn("Repo.other")(function* () {}) };',
        "const create = Effect.fn(spanName)(function* () {});",
        'const update = Other.fn("Repo.create")(function* () {});',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("honours ignorePattern for deliberate aliases", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'export const handler = Effect.fn("Http.createTodo")(function* () {});\n', {
      ruleOptions: { ignorePattern: "^Http\\." },
    }),
  ).resolves.toBeUndefined();
});

it("suggests replacing only the last segment", async () => {
  await expect(
    fixCode(ruleName, 'const create = Effect.fn("TodoRepo.getById")(function* () {});\n', "suggestions"),
  ).resolves.toBe('const create = Effect.fn("TodoRepo.create")(function* () {});\n');
});
