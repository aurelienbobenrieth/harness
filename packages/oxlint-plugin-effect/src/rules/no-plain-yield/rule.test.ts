import { expect, it } from "vitest";
import { fixCode } from "../sota-test-support.ts";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-plain-yield";

it("reports a plain yield inside Effect.gen", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const program = Effect.gen(function* () { const user = yield repo.find(id); return user; });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports a plain yield inside curried Effect.fn and Effect.fnUntraced bodies", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const load = Effect.fn("load")(function* (id: string) { return yield repo.find(id); });\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "const load = Effect.fnUntraced(function* (id: string) { return yield repo.find(id); });\n",
    ),
  ).resolves.toBeUndefined();
});

it("resolves Effect namespace aliases", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import * as T from "effect/Effect";\nconst program = T.gen(function* () { return yield load; });\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows delegated yields", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const program = Effect.gen(function* () { return yield* repo.find(id); });\n"),
  ).resolves.toBeUndefined();
});

it("allows plain yields in ordinary generators, including ones nested in an Effect body", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "function* ids() { yield 1; }\nconst program = Effect.gen(function* () { function* inner() { yield 2; } return yield* run(inner); });\n",
    ),
  ).resolves.toBeUndefined();
});

it("ignores a local object that shadows Effect", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const Effect = { gen: (body: () => Generator) => body };\nEffect.gen(function* () { yield 1; });\n",
    ),
  ).resolves.toBeUndefined();
});

it("inserts the missing star", async () => {
  await expect(
    fixCode(ruleName, "const program = Effect.gen(function* () { const user = yield repo.find(id); return user; });\n"),
  ).resolves.toBe("const program = Effect.gen(function* () { const user = yield* repo.find(id); return user; });\n");
});
