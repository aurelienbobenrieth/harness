import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/prefer-effect-fn";

it("reports an arrow that only returns Effect.gen", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const getUser = (id: string) => Effect.gen(function* () { return yield* repo.find(id); });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports function declarations and piped generators", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'function getUser(id: string) { return Effect.gen(function* () { return yield* repo.find(id); }).pipe(Effect.withSpan("getUser")); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows Effect.fn definitions and zero-parameter thunks", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const getUser = Effect.fn("getUser")(function* (id: string) { return yield* repo.find(id); });',
        "const program = () => Effect.gen(function* () { return yield* repo.all; });",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows functions that do more than wrap the generator", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const getUser = (id: string) => { const key = normalize(id); return Effect.gen(function* () { return yield* repo.find(key); }); };",
        "const viaOther = (id: string) => Other.gen(function* () { return id; });",
        "const flat = (id: string) => Effect.flatMap(repo.find(id), (user) => Effect.gen(function* () { return user; }));",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("skips generic functions, this-bound generators, class methods and inline callbacks", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const decode = <A>(schema: Codec<A>) => Effect.gen(function* () { return yield* run(schema); });",
        "const bound = function (id: string) { return Effect.gen(function* () { return yield* this.find(id); }); };",
        "class Repo { find(id: string) { return Effect.gen(function* () { return id; }); } }",
        "const all = ids.map((id) => Effect.gen(function* () { return yield* repo.find(id); }));",
        "const each = Effect.forEach(ids, (id) => Effect.gen(function* () { return yield* repo.find(id); }), { concurrency: 2 });",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});
