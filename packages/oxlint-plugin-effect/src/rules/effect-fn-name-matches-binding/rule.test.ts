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

it("accepts the snake_case words of the binding, which telemetry-name-format requires", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const markProcessed = Effect.fn("webhooks.mark_processed")(function* () {});',
        'const repo = { writeUiMirror: Effect.fn("merchants.write_ui_mirror")(function* () {}) };',
        'const parseHTMLBody = Effect.fn("html.parse_html_body")(function* () {});',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("accepts the trailing words of a longer binding", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const leaksViewRun = Effect.fn("leaks.view_run")(function* () {});',
        'const makeFrameworkSite = Effect.fn("AWS.Website.FrameworkSite")(function* () {});',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("reports a snake_case name that names other words, and suggests the snake_case of the binding", async () => {
  await expect(
    assertRuleReports(ruleName, 'const outputOf = Effect.fn("dev.output")(function* () {});\n'),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, 'const markProcessed = Effect.fn("webhooks.mark_done")(function* () {});\n'),
  ).resolves.toBeUndefined();
  await expect(
    fixCode(ruleName, 'const markProcessed = Effect.fn("webhooks.mark_done")(function* () {});\n', "suggestions"),
  ).resolves.toContain('"webhooks.mark_processed"');
});
