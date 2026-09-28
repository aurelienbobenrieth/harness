import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineRemovalPolicyChange, removalPolicyChange } from "./rule.js";

async function change(before: string, after: string, rule = removalPolicyChange): Promise<string[]> {
  const findings = await testRuleOnChange({
    rule,
    fixture: { before: { "alchemy.run.ts": `${before}\n` }, after: { "alchemy.run.ts": `${after}\n` } },
  });
  return findings.map((finding) => finding.message);
}

it("reports a removed retain for human review", async () => {
  const findings = await testRuleOnChange({
    rule: removalPolicyChange,
    fixture: {
      before: { "alchemy.run.ts": 'yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain());\n' },
      after: { "alchemy.run.ts": 'yield* Cloudflare.D1.Database("Orders");\n' },
    },
  });
  expect(findings.map((finding) => [finding.authority, finding.message])).toEqual([
    [
      "human",
      "This change removes RemovalPolicy.retain(): the next orphan delete, destroy or replacement deletes the cloud object and its data. Confirm the data is disposable in every affected stage, or keep the retention.",
    ],
  ]);
});

it("reports a narrowed retain, an added destroy and retain(false)", async () => {
  expect(
    await change(
      'yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain());',
      'yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain(stack.stage === "prod"));',
    ),
  ).toEqual([expect.stringContaining("removes RemovalPolicy.retain()")]);
  expect(
    await change(
      'yield* GitHub.Repository("Docs", props);',
      'yield* GitHub.Repository("Docs", props).pipe(Alchemy.RemovalPolicy.destroy());',
    ),
  ).toEqual([expect.stringContaining("adds RemovalPolicy.destroy()")]);
  expect(
    await change(
      'yield* Cloudflare.KV.Namespace("Cache");',
      'yield* Cloudflare.KV.Namespace("Cache").pipe(RemovalPolicy.retain(false));',
    ),
  ).toEqual([expect.stringContaining("adds RemovalPolicy.destroy()")]);
});

it("reports forceDestroy set on an existing bucket but not on a new one", async () => {
  expect(
    await change(
      'yield* Cloudflare.R2.Bucket("Uploads");',
      'yield* Cloudflare.R2.Bucket("Uploads", { forceDestroy: true });',
    ),
  ).toEqual([expect.stringContaining('sets forceDestroy on R2.Bucket("Uploads")')]);
  expect(await change("", 'yield* Cloudflare.R2.Bucket("Cache", { forceDestroy: true });')).toEqual([]);
});

it("stays silent when retention is added, kept, removed with its declaration or relaxed with destroy(false)", async () => {
  const retained = 'yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain());';
  expect(await change('yield* Cloudflare.D1.Database("Orders");', retained)).toEqual([]);
  expect(await change(retained, `${retained}\nyield* Cloudflare.KV.Namespace("Cache");`)).toEqual([]);
  expect(await change(retained, "")).toEqual([]);
  expect(
    await change(
      'yield* GitHub.Repository("Docs", props);',
      'yield* GitHub.Repository("Docs", props).pipe(RemovalPolicy.destroy(false));',
    ),
  ).toEqual([]);
});

it("discounts retains of removed declarations only for the configured resources", async () => {
  const rule = defineRemovalPolicyChange({ resources: ["Queues.Queue"] });
  expect(await change('yield* Cloudflare.Queues.Queue("Jobs").pipe(RemovalPolicy.retain());', "", rule)).toEqual([]);
  expect(await change('yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain());', "", rule)).toHaveLength(
    1,
  );
});

const db = (pipe: string): string => `yield* Cloudflare.D1.Database("Orders").pipe(${pipe});`;

it("treats equivalent spellings as the same policy and never reports a switch to unconditional retain", async () => {
  const results = await Promise.all([
    change(db("RemovalPolicy.retain(true)"), db("RemovalPolicy.retain()")),
    change(db("RemovalPolicy.destroy(false)"), db("RemovalPolicy.retain()")),
    change(db('RemovalPolicy.retain(stack.stage === "prod")'), db("RemovalPolicy.retain()")),
    change(db("RemovalPolicy.destroy()"), db("RemovalPolicy.retain(false)")),
  ]);
  expect(results).toEqual([[], [], [], []]);
});
