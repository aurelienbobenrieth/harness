import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineInitConfigExposure, initConfigExposure } from "./rule.js";

async function messages(source: string, rule = initConfigExposure): Promise<string[]> {
  const findings = await testRuleOnSource({ rule, source, file: "src/worker.ts" });
  return findings.map((finding) => finding.message);
}

it("reports each config key yielded in a Worker init, including the class form and a piped init", async () => {
  expect(
    await messages(
      [
        'export default class Api extends Cloudflare.Worker<Api>()("Api", { main: import.meta.url }, Effect.gen(function* () {',
        '  const key = yield* Config.Redacted("API_KEY");',
        '  const port = yield* Config.Number("PORT").pipe(Config.withDefault(3000));',
        "  return { fetch: handler(key, port) };",
        "}).pipe(Effect.provide(Live))) {}",
      ].join("\n"),
    ),
  ).toEqual([
    "`API_KEY` is read in the Cloudflare.Worker init: Alchemy binds it to the deployed runtime as a secret with the deployer's value. Keep it only if the runtime needs it; read deploy-only values in the stack body.",
    expect.stringContaining("`PORT` is read in the Cloudflare.Worker init"),
  ]);
});

it("reports Lambda init reads", async () => {
  expect(
    await messages(
      'export default AWS.Lambda.Function("Fn", props, Effect.gen(function* () { const secret = yield* Config.String("AWS_SECRET_ACCESS_KEY"); return {}; }));',
    ),
  ).toEqual([expect.stringContaining("`AWS_SECRET_ACCESS_KEY` is read in the AWS.Lambda.Function init")]);
});

it("stays silent for runtime handler reads, props effects, stack bodies and non-gen inits", async () => {
  expect(
    await messages(
      [
        'Cloudflare.Worker("Api", Effect.gen(function* () { return { main: yield* Config.String("MAIN") }; }), Effect.succeed({ fetch }));',
        'Cloudflare.Worker("Api", props, Effect.gen(function* () { return { fetch: Effect.gen(function* () { return yield* Config.String("LATE"); }) }; }));',
        'Alchemy.Stack("App", options, Effect.gen(function* () { const token = yield* Config.Redacted("TOKEN"); }));',
        'Cloudflare.Worker("Api", props, Effect.fn(function* () { yield* Config.String("NOT_GEN"); }));',
        'Cloudflare.Worker("Api", props, Effect.gen(function* () { yield* Config.all(configs); yield* Effect.log("x"); }));',
        'Cloudflare.Worker("Api", props, Effect.gen(function* () { yield* Config.String("KEY"); }).map(identity));',
      ].join("\n"),
    ),
  ).toEqual([]);
});

it("supports a custom runtime pattern, stateless across runs", async () => {
  const rule = defineInitConfigExposure({ runtimePattern: /(?:^|\.)Service$/gu });
  const source = 'Fly.Service("Api", props, Effect.gen(function* () { yield* Config.String("KEY"); }));';
  expect(await messages(source, rule)).toHaveLength(1);
  expect(await messages(source, rule)).toHaveLength(1);
  expect(await messages(source)).toEqual([]);
});
