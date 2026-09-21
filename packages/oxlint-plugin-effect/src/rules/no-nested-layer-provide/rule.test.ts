import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-nested-layer-provide";

it("reports Layer.provide nested directly inside Layer.provide", async () => {
  await expect(
    assertRuleReports(ruleName, "const app = Layer.provide(ApiLive, Layer.provide(DbLive, ConfigLive));\n"),
  ).resolves.toBeUndefined();
});

it("reports Layer.provideMerge nested inside Layer.provide", async () => {
  await expect(
    assertRuleReports(ruleName, "const app = Layer.provide(ApiLive, Layer.provideMerge(DbLive, ConfigLive));\n"),
  ).resolves.toBeUndefined();
});

it("reports provision calls nested deeper inside argument expressions", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const app = Layer.provide(ApiLive, [Layer.provide(DbLive, ConfigLive), CacheLive]);\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows a single Layer.provide call", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const app = Layer.provide(ApiLive, [DbLive, ConfigLive]);\n"),
  ).resolves.toBeUndefined();
});

it("allows sibling Layer.provide calls in separate declarations", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const dbLive = Layer.provide(DbLive, ConfigLive);\nconst app = Layer.provide(ApiLive, dbLive);\n",
    ),
  ).resolves.toBeUndefined();
});
