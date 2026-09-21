import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "type-evidence/no-unknown-returns";

it("reports functions returning unknown", async () => {
  await expect(assertRuleReports(ruleName, "function load(): unknown { return 1; }\n")).resolves.toBeUndefined();
});

it("reports Promise of unknown", async () => {
  await expect(
    assertRuleReports(ruleName, "async function load(): Promise<unknown> { return 1; }\n"),
  ).resolves.toBeUndefined();
});

it("reports PromiseLike of unknown", async () => {
  await expect(
    assertRuleReports(ruleName, "function load(): PromiseLike<unknown> { return Promise.resolve(1); }\n"),
  ).resolves.toBeUndefined();
});

it("reports unknown inside union return types", async () => {
  await expect(
    assertRuleReports(ruleName, "function load(): string | unknown { return 1; }\n"),
  ).resolves.toBeUndefined();
});

it("reports unknown reached through a same-file alias", async () => {
  await expect(
    assertRuleReports(ruleName, "type Result = unknown;\nfunction load(): Result { return 1; }\n"),
  ).resolves.toBeUndefined();
});

it("reports aliased unknown inside a Promise", async () => {
  await expect(
    assertRuleReports(ruleName, "type Result = unknown;\nasync function load(): Promise<Result> { return 1; }\n"),
  ).resolves.toBeUndefined();
});

it("allows omitting the return annotation", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "function load() { return compute(); }\n")).resolves.toBeUndefined();
});

it("allows unknown nested inside a named object type", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function load(): { cause: unknown } { return { cause: 1 }; }\n"),
  ).resolves.toBeUndefined();
});

it("allows concrete Promise results", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'async function load(): Promise<string> { return "done"; }\n'),
  ).resolves.toBeUndefined();
});

it("accepts regression: type Recursive = Promise<Recursive>; function load(): Recursive { return load(); }", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    "type Recursive = Promise<Recursive>; function load(): Recursive { return load(); }",
  );
});

it("accepts regression: type A = Promise<B>; type B = Promise<A>; function load(): A { return load(); }", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    "type A = Promise<B>; type B = Promise<A>; function load(): A { return load(); }",
  );
});
