import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-effect-type-assertion";

it("reports assertions that rewrite Effect channels", async () => {
  await expect(
    assertRuleReports(ruleName, "const safe = program as Effect.Effect<User, never, never>;\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const safe = program as unknown as Effect.Effect<User, never>;\n"),
  ).resolves.toBeUndefined();
});

it("reports Layer and Stream channel assertions through namespace imports", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import * as L from "effect/Layer";\nconst live = layer as L.Layer<Db, never, never>;\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const events = source as Stream.Stream<Event, never>;\n"),
  ).resolves.toBeUndefined();
});

it("allows satisfies, annotations and success-only assertions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = program satisfies Effect.Effect<User, NotFound, never>;",
        "const b: Effect.Effect<User, NotFound> = program;",
        "const c = program as Effect.Effect<User>;",
        "const d = value as User;",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("ignores look-alike namespaces from other libraries", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import type { Effect } from "./my-effects";\nconst a = program as Effect.Effect<User, never, never>;\n',
    ),
  ).resolves.toBeUndefined();
});
