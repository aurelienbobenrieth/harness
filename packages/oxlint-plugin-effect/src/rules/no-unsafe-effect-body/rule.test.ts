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

it('reports regression: Effect.fn("work")(function* () { throw new Error("oops"); });', async () => {
  await assertRuleReports(ruleName, 'Effect.fn("work")(function* () { throw new Error("oops"); });');
});

it("reports throw inside Effect.fnUntraced", async () => {
  await expect(
    assertRuleReports(ruleName, 'const run = Effect.fnUntraced(function* () { throw new Error("boom"); });\n'),
  ).resolves.toBeUndefined();
});

it("reports await inside Effect.fnUntracedEager", async () => {
  await expect(
    assertRuleReports(ruleName, "const run = Effect.fnUntracedEager(async function* () { return await load(); });\n"),
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

it("ignores generators of a local object shadowing Effect", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'const Effect = { gen: (body: unknown) => body };\nconst program = Effect.gen(function* () { throw new Error("boom"); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports try/catch around yield*", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const program = Effect.gen(function* () { try { yield* loadUser(id); } catch (error) { console.error(error); } });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports try/finally around yield*", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const program = Effect.gen(function* () { try { yield* loadUser(id); } finally { release(); } });\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows try/catch around synchronous code without yield*", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const program = Effect.gen(function* () { try { parse(input); } catch (error) { yield* Effect.logError(error); } return yield* loadUser(id); });\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows try/catch around yield* outside Effect generators", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const program = Other.gen(function* () { try { yield* loadUser(id); } catch (error) { report(error); } });\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores yield* of a nested non-Effect generator inside try", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const program = Effect.gen(function* () { try { run(function* () { yield* items; }); } catch (error) { report(error); } });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports setTimeout inside an Effect body", async () => {
  await expect(
    assertRuleReports(ruleName, "const program = Effect.gen(function* () { setTimeout(() => notify(), 1000); });\n"),
  ).resolves.toBeUndefined();
});

it("reports globalThis.setInterval inside Effect.fn", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const poll = Effect.fn("poll")(function* () { globalThis.setInterval(tick, 1000); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows timers inside the Effect.callback register function", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const program = Effect.gen(function* () { yield* Effect.callback((resume) => { const id = setTimeout(() => resume(Effect.void), 10); return Effect.sync(() => clearTimeout(id)); }); });\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores locally declared timer functions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "function setTimeout(run: () => void) { run(); }\nconst program = Effect.gen(function* () { setTimeout(() => notify()); });\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores timers outside Effect bodies", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function schedule() { setTimeout(() => notify(), 1000); }\n"),
  ).resolves.toBeUndefined();
});
