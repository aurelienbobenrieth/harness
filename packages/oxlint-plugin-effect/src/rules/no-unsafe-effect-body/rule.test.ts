import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-unsafe-effect-body";

it("reports throw inside Effect.gen", async () => {
  await expect(
    assertRuleReports(ruleName, 'const program = Effect.gen(function* () { throw new Error("boom"); });\n'),
  ).resolves.toBeUndefined();
});

it("reports throw inside Effect.fn", async () => {
  await expect(
    assertRuleReports(ruleName, 'const run = Effect.fn(function* run() { throw new Error("boom"); });\n'),
  ).resolves.toBeUndefined();
});

it('reports regression: Effect.fn("work")(function* () { throw new Error("oops"); });', async () => {
  await assertRuleReports(ruleName, 'Effect.fn("work")(function* () { throw new Error("oops"); });');
});

it("reports throw inside Effect.fnUntraced", async () => {
  await expect(
    assertRuleReports(ruleName, 'const run = Effect.fnUntraced(function* () { throw new Error("boom"); });\n'),
  ).resolves.toBeUndefined();
});

it("reports throw inside an aliased Effect import", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { Effect as E } from "effect";\nconst program = E.gen(function* () { throw new Error("boom"); });\n',
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

it("ignores generators of a local object shadowing Effect", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'const Effect = { gen: (body: unknown) => body };\nconst program = Effect.gen(function* () { throw new Error("boom"); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("leaves try/catch, await, and global timers to @effect/tsgo and the type checker", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = Effect.gen(function* () { try { yield* loadUser(id); } catch (error) { report(error); } });",
        "const b = Effect.gen(function* () { setTimeout(() => notify(), 1000); });",
        "const c = Effect.gen(async function* () { return await load(); });",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});
