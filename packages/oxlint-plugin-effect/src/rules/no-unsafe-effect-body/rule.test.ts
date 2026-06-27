import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-unsafe-effect-body";

it("reports throw inside Effect.gen", async () => {
  await expect(
    assertRuleReports(ruleName, 'const program = Effect.gen(function* () { throw new Error("boom"); });\n'),
  ).resolves.toBeUndefined();
});

it("reports await inside Effect.gen", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const program = Effect.gen(async function* () { const value = await loadValue(); return value; });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports throw inside Effect.fn", async () => {
  await expect(
    assertRuleReports(ruleName, 'const run = Effect.fn(function* run() { throw new Error("boom"); });\n'),
  ).resolves.toBeUndefined();
});

it("reports await inside named Effect.fn", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const run = Effect.fn("run", async function* () { const value = await loadValue(); return value; });\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows yielded failures inside Effect.gen", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const program = Effect.gen(function* () { return yield* Effect.fail(new DomainError()); });\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows yielded promises inside Effect.gen", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const program = Effect.gen(function* () { const value = yield* Effect.promise(() => loadValue()); return value; });\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows throw outside Effect bodies", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'function parse() { throw new Error("boom"); }\n'),
  ).resolves.toBeUndefined();
});

it("does not report nested non-Effect callback bodies", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'const program = Effect.gen(function* () { items.map(() => { throw new Error("boom"); }); });\n',
    ),
  ).resolves.toBeUndefined();
});
