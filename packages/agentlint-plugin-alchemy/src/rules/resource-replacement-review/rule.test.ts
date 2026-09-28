import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";
import type { ChangeFixture } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import { defineResourceReplacementReview, resourceReplacementReview } from "./rule.js";

async function messages(fixture: ChangeFixture, rule = resourceReplacementReview): Promise<string[]> {
  const findings = await testRuleOnChange({ rule, fixture });
  return findings.map((finding) => finding.message);
}

const stack = (body: string): string =>
  `export default Alchemy.Stack("App", { providers: Cloudflare.providers(), state: localState() }, Effect.gen(function* () {\n${body}\n}));\n`;

it("reports a logical ID change without renamedFrom, for human review", async () => {
  const findings = await testRuleOnChange({
    rule: resourceReplacementReview,
    fixture: {
      before: { "alchemy.run.ts": stack('  const bucket = yield* Cloudflare.R2.Bucket("Bucket");') },
      after: { "alchemy.run.ts": stack('  const bucket = yield* Cloudflare.R2.Bucket("Assets");') },
    },
  });
  expect(findings.map((finding) => [finding.authority, finding.line, finding.lineageKey])).toEqual([
    ["human", 2, "logical-id:R2.Bucket:Bucket"],
  ]);
  expect(findings[0]?.message).toContain('Alchemy.renamedFrom("Bucket")');
});

it("stays silent when renamedFrom claims the former ID, bare or as an FQN", async () => {
  const results = await Promise.all(
    ['"Bucket"', '{ fqn: "Site/Bucket" }'].map((claim) =>
      messages({
        before: { "alchemy.run.ts": stack('  yield* Cloudflare.R2.Bucket("Bucket");') },
        after: {
          "alchemy.run.ts": stack(
            `  yield* Cloudflare.R2.Bucket("Assets").pipe(\n    Alchemy.renamedFrom(${claim}),\n  );`,
          ),
        },
      }),
    ),
  );
  expect(results).toEqual([[], []]);
});

it("reports a removed declaration unless it was already retained unconditionally", async () => {
  const removed = await messages({
    before: {
      "alchemy.run.ts": stack('  yield* Cloudflare.D1.Database("Orders");\n  yield* Cloudflare.KV.Namespace("Cache");'),
    },
    after: { "alchemy.run.ts": stack('  yield* Cloudflare.KV.Namespace("Cache");') },
  });
  expect(removed).toHaveLength(1);
  expect(removed[0]).toContain('D1.Database "Orders" is removed');

  expect(
    await messages({
      before: { "alchemy.run.ts": stack('  yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain());') },
      after: { "alchemy.run.ts": stack("") },
    }),
  ).toEqual([]);
  expect(
    await messages({
      before: {
        "alchemy.run.ts": stack(
          '  yield* Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain(stage === "prod"));',
        ),
      },
      after: { "alchemy.run.ts": stack("") },
    }),
  ).toHaveLength(1);
});

it("reports declarations lost with a deleted file and ignores declarations moved between files", async () => {
  expect(
    await messages({
      before: { "infra/storage.ts": 'export const Uploads = Cloudflare.R2.Bucket("Uploads");\n' },
      after: {},
    }),
  ).toHaveLength(1);
  expect(
    await messages({
      before: {
        "infra/a.ts": 'export const Uploads = Cloudflare.R2.Bucket("Uploads");\n',
        "infra/b.ts": "export {};\n",
      },
      after: {
        "infra/a.ts": "export {};\n",
        "infra/b.ts": 'export const Uploads = Cloudflare.R2.Bucket("Uploads");\n',
      },
    }),
  ).toEqual([]);
});

it("reports replace-triggering props per the provider diff", async () => {
  const change = (before: string, after: string) =>
    messages({
      before: { "alchemy.run.ts": stack(`  yield* ${before};`) },
      after: { "alchemy.run.ts": stack(`  yield* ${after};`) },
    });

  expect(await change('Cloudflare.R2.Bucket("B", { jurisdiction: "eu" })', 'Cloudflare.R2.Bucket("B")')).toEqual([
    'R2.Bucket "B" changes `jurisdiction` ("eu" → "default"): Alchemy plans a replace, which creates a new, empty R2.Bucket and deletes the old one with its data. Revert the prop or confirm the data is disposable or migrated.',
  ]);
  expect(
    await change(
      'Cloudflare.R2.Bucket("B", { locationHint: "weur" })',
      "Cloudflare.R2.Bucket('B', { locationHint: 'eeur' })",
    ),
  ).toHaveLength(1);
  expect(await change('Cloudflare.R2.Bucket("B")', 'Cloudflare.R2.Bucket("B", { name: "assets" })')).toHaveLength(1);
  expect(
    await change(
      'Cloudflare.D1.Database("D", { primaryLocationHint: "weur" })',
      'Cloudflare.D1.Database("D", { primaryLocationHint: "apac" })',
    ),
  ).toHaveLength(1);
});

it("stays silent for prop changes that update in place or keep the deployed value", async () => {
  const change = (before: string, after: string) =>
    messages({
      before: { "alchemy.run.ts": stack(`  yield* ${before};`) },
      after: { "alchemy.run.ts": stack(`  yield* ${after};`) },
    });

  expect(await change('Cloudflare.R2.Bucket("B", { name: "assets" })', 'Cloudflare.R2.Bucket("B")')).toEqual([]);
  expect(
    await change('Cloudflare.D1.Database("D", { primaryLocationHint: "weur" })', 'Cloudflare.D1.Database("D")'),
  ).toEqual([]);
  expect(
    await change(
      'Cloudflare.R2.Bucket("B", { storageClass: "Standard" })',
      'Cloudflare.R2.Bucket("B", { storageClass: "InfrequentAccess" })',
    ),
  ).toEqual([]);
  expect(await change('Cloudflare.R2.Bucket("B", props)', 'Cloudflare.R2.Bucket("B", otherProps)')).toEqual([]);
  expect(
    await change(
      'Cloudflare.R2.Bucket("B", {\n  jurisdiction: "eu",\n})',
      "Cloudflare.R2.Bucket(\"B\", { jurisdiction: 'eu' })",
    ),
  ).toEqual([]);
});

it("ignores declarations inside comments and strings", async () => {
  expect(
    await messages({
      before: {
        "alchemy.run.ts": stack(
          '  // yield* Cloudflare.R2.Bucket("Old");\n  const doc = "Cloudflare.D1.Database(\\"Gone\\")";',
        ),
      },
      after: { "alchemy.run.ts": stack("") },
    }),
  ).toEqual([]);
});

it("reports a renamed stack and stays silent for an unchanged one", async () => {
  const renamed = await messages({
    before: { "alchemy.run.ts": 'export default Alchemy.Stack("Backend", { state: localState() }, program);\n' },
    after: { "alchemy.run.ts": 'export default Alchemy.Stack("Api", { state: localState() }, program);\n' },
  });
  expect(renamed).toHaveLength(1);
  expect(renamed[0]).toContain('Stack "Backend" is renamed to "Api"');

  expect(
    await messages({
      before: {
        "alchemy.run.ts": 'export default class App extends Alchemy.Stack<App>()("Backend", { state: s }, a) {}\n',
      },
      after: {
        "alchemy.run.ts": 'export default class App extends Alchemy.Stack<App>()("Backend", { state: s }, b) {}\n',
      },
    }),
  ).toEqual([]);
});

it("watches a configured resource map instead of the default one", async () => {
  const rule = defineResourceReplacementReview({ resources: { "Queues.Queue": { name: "changed" } } });
  const fixture = {
    before: {
      "alchemy.run.ts":
        'yield* Cloudflare.Queues.Queue("Jobs", { name: "jobs" });\nyield* Cloudflare.D1.Database("A");\n',
    },
    after: {
      "alchemy.run.ts":
        'yield* Cloudflare.Queues.Queue("Jobs", { name: "jobs-v2" });\nyield* Cloudflare.D1.Database("B");\n',
    },
  };
  expect(await messages(fixture, rule)).toEqual([
    'Queues.Queue "Jobs" changes `name` ("jobs" → "jobs-v2"): Alchemy plans a replace, which creates a new, empty Queues.Queue and deletes the old one with its data. Revert the prop or confirm the data is disposable or migrated.',
  ]);
});

it("fails instead of passing when a snapshot has no content", async () => {
  await expect(
    testRuleOnChange({
      rule: resourceReplacementReview,
      fixture: {
        change: {
          baseline: { kind: "git", ref: "main" },
          files: [
            {
              status: "modified",
              path: "alchemy.run.ts",
              before: { digest: "a" },
              after: { digest: "b", content: "export {};\n" },
              hunks: [],
            },
          ],
        },
      },
    }),
  ).rejects.toThrow("missing change snapshot for alchemy.run.ts");
});

it("treats a missing jurisdiction as the default jurisdiction", async () => {
  const change = (before: string, after: string) =>
    messages({ before: { "alchemy.run.ts": `${before}\n` }, after: { "alchemy.run.ts": `${after}\n` } });
  const results = await Promise.all([
    change('yield* Cloudflare.R2.Bucket("B");', 'yield* Cloudflare.R2.Bucket("B", { jurisdiction: "default" });'),
    change('yield* Cloudflare.D1.Database("D", { jurisdiction: "default" });', 'yield* Cloudflare.D1.Database("D");'),
    change('yield* Cloudflare.R2.Bucket("B");', 'yield* Cloudflare.R2.Bucket("B", { jurisdiction: "eu" });'),
  ]);
  expect(results.map((result) => result.length)).toEqual([0, 0, 1]);
});
