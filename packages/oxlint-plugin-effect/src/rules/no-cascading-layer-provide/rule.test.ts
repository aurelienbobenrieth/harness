import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-cascading-layer-provide";

it("reports cascading provisions inside a pipe call", async () => {
  await expect(
    assertRuleReports(ruleName, "const app = pipe(ApiLive, Layer.provide(DbLive), Layer.provide(ConfigLive));\n"),
  ).resolves.toBeUndefined();
});

it("reports cascading provisions inside a .pipe chain", async () => {
  await expect(
    assertRuleReports(ruleName, "const app = ApiLive.pipe(Layer.provide(DbLive), Layer.provideMerge(ConfigLive));\n"),
  ).resolves.toBeUndefined();
});

it("reports cascading provisions across chained .pipe calls", async () => {
  await expect(
    assertRuleReports(ruleName, "const app = ApiLive.pipe(Layer.provide(DbLive)).pipe(Layer.provide(ConfigLive));\n"),
  ).resolves.toBeUndefined();
});

it("allows a single Layer.provide step in a pipe", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const app = pipe(ApiLive, Layer.provide([DbLive, ConfigLive]));\n"),
  ).resolves.toBeUndefined();
});

it("allows a single Layer.provide step in a .pipe chain", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const app = ApiLive.pipe(Layer.provide([DbLive, ConfigLive]));\n"),
  ).resolves.toBeUndefined();
});

it("allows pipes mixing one provision with other operators", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const app = pipe(ApiLive, Layer.provide(DbLive), Layer.orDie);\n"),
  ).resolves.toBeUndefined();
});
