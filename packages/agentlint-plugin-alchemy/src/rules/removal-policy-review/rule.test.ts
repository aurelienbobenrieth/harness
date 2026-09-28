import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineRemovalPolicyReview, removalPolicyReview } from "./rule.js";

async function messages(source: string, rule = removalPolicyReview): Promise<string[]> {
  const findings = await testRuleOnSource({ rule, source, file: "alchemy.run.ts" });
  return findings.map((finding) => finding.message);
}

it("reports each stateful resource on the default destroy policy", async () => {
  expect(
    await messages(
      [
        'const bucket = yield* Cloudflare.R2.Bucket("Uploads");',
        'const db = yield* Cloudflare.D1.Database("Orders", { primaryLocationHint: "weur" });',
        'const kv = yield* KV.Namespace("Cache");',
      ].join("\n"),
    ),
  ).toEqual([
    'R2.Bucket("Uploads") uses the default destroy removal policy: removing, renaming or replacing it deletes the cloud object and its data. Pipe it through `RemovalPolicy.retain(stack.stage === "prod")` or confirm the data is disposable.',
    expect.stringContaining('D1.Database("Orders") uses the default destroy removal policy'),
    expect.stringContaining('KV.Namespace("Cache") uses the default destroy removal policy'),
  ]);
});

it("stays silent when the declaration or its enclosing scope carries a policy", async () => {
  expect(
    await messages(
      [
        'const a = yield* Cloudflare.R2.Bucket("A").pipe(RemovalPolicy.retain());',
        'const b = yield* Cloudflare.D1.Database("B").pipe(Alchemy.RemovalPolicy.destroy());',
        'export const C = Cloudflare.KV.Namespace("C").pipe(retainOnDeployedStage);',
        'const scope = Effect.gen(function* () { yield* Cloudflare.R2.Bucket("D"); }).pipe(RemovalPolicy.retain());',
      ].join("\n"),
    ),
  ).toEqual([]);
});

it("reports a retain condition that reads Stage through an Effect, not one that reads Stack", async () => {
  expect(
    await messages(
      'export const Db = Cloudflare.D1.Database("Db").pipe(RemovalPolicy.retain(Effect.map(Alchemy.Stage, isProd)));',
    ),
  ).toEqual([expect.stringContaining("alchemy#1738")]);
  expect(
    await messages(
      'export const Db = Cloudflare.D1.Database("Db").pipe(RemovalPolicy.retain(Effect.map(Alchemy.Stack, (stack) => stack.stage === "prod")));',
    ),
  ).toEqual([]);
});

it("ignores other resources and supports a custom resource list", async () => {
  expect(await messages('yield* Cloudflare.Worker("Api", props); yield* Cloudflare.Queues.Queue("Jobs");')).toEqual([]);
  const rule = defineRemovalPolicyReview({ resources: ["Queues.Queue"] });
  expect(await messages('yield* Cloudflare.Queues.Queue("Jobs"); yield* Cloudflare.D1.Database("Db");', rule)).toEqual([
    expect.stringContaining('Queues.Queue("Jobs")'),
  ]);
});
