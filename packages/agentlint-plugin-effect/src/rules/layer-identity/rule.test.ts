import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { layerIdentity } from "./rule.js";

async function findingLines(source: string): Promise<ReadonlyArray<number>> {
  const findings = await testRuleOnSource(layerIdentity, source, "src/module.ts");
  return findings.map((finding) => finding.line);
}

it("reports an arrow function that returns a built layer", async () => {
  expect(
    await findingLines("const makeDbLayer = (config: DbConfig) => Layer.effect(Db, connect(config));"),
  ).toHaveLength(1);
});

it("reports a function declaration that returns a piped layer", async () => {
  expect(
    await findingLines(
      "function makeDbLayer(config: DbConfig) {\n  return Layer.effect(Db, connect(config)).pipe(Layer.provide(PoolLive));\n}",
    ),
  ).toHaveLength(1);
});

it("reports a static method that returns a built layer", async () => {
  expect(
    await findingLines("class Db { static layerWith(config: DbConfig) { return Layer.effect(Db, connect(config)); } }"),
  ).toHaveLength(1);
});

it("ignores layers bound once at module level", async () => {
  expect(await findingLines("export const DbLive = Layer.effect(Db, connect(productionConfig));")).toEqual([]);
});

it("ignores functions that use Layer without returning one", async () => {
  expect(
    await findingLines(
      "const run = (program: Program) => Effect.provide(program, Layer.mergeAll(DbLive, CacheLive));\nfunction build() { const layer = Layer.mergeAll(DbLive, CacheLive); return ManagedRuntime.make(layer); }",
    ),
  ).toEqual([]);
});

it("ignores value-only and explicitly fresh layers", async () => {
  expect(
    await findingLines(
      "const makeConfigLayer = (config: DbConfig) => Layer.succeed(Config, config);\nconst isolated = () => Layer.fresh(DbLive);",
    ),
  ).toEqual([]);
});

it("ignores LayerMap lookups", async () => {
  expect(
    await findingLines(
      [
        "const tenants = LayerMap.make((tenant: string) => Layer.effect(Db, connect(tenant)));",
        'class Tenants extends LayerMap.Service<Tenants>()("app/Tenants", {',
        "  lookup: (tenant: string) => Layer.effect(Db, connect(tenant)),",
        "}) {}",
      ].join("\n"),
    ),
  ).toEqual([]);
});

it("ignores generators that return a layer to Layer.unwrap", async () => {
  expect(
    await findingLines(
      "export const DbLive = Layer.unwrap(Effect.gen(function* () { const config = yield* DbConfig; return Layer.effect(Db, connect(config)); }));",
    ),
  ).toEqual([]);
});
