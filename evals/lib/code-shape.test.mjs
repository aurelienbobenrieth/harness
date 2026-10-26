import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFixture, command, git } from "../code-shape/fixture.mjs";
import { metrics } from "../code-shape/metrics.mjs";
import { acceptance } from "../code-shape/acceptance.mjs";
import { ruleNames, validateJudgment } from "../code-shape/grade.mjs";
import { summarize } from "../code-shape/report.mjs";
import { normalize } from "./transcript.mjs";
import { retention } from "../code-shape/retention.mjs";

test("retention rejects pass loss, unused helpers and confounded apparent savings", () => {
  const evidence = [];
  for (const provider of ["claude", "codex"])
    for (const seed of [1, 2])
      for (const condition of ["prose", "scripted"]) {
        evidence.push({
          provider,
          seed,
          condition,
          suite: "quality",
          task: "git",
          pass: true,
          calls: condition === "prose" ? 5 : 4,
          tokens: { input: 100, cached: 200 },
          helperCalls:
            condition === "prose" ? [] : [{ arguments: { command: "node .agents/skills/git/scripts/draft.mjs" } }],
        });
      }
  evidence.push(
    ...["prose", "scripted"].map((condition) => ({
      provider: "claude",
      seed: 1,
      condition,
      suite: "shape",
      task: "boundary",
      pass: true,
      calls: 2,
      tokens: { input: 100 },
      helperCalls: [],
      judgment: { rules: [{ score: condition === "prose" ? 2 : 3 }] },
    })),
  );
  assert.equal(retention(evidence).find((decision) => decision.helper === "draft").keep, true);
  const loss = structuredClone(evidence);
  loss.find((row) => row.condition === "scripted" && row.suite === "quality").pass = false;
  assert.equal(retention(loss)[0].keep, false);
  assert.equal(retention(evidence.map((row) => ({ ...row, helperCalls: [] })))[0].keep, false);
  const mixed = structuredClone(evidence);
  mixed
    .find((row) => row.condition === "scripted" && row.suite === "quality")
    .helperCalls.push({
      arguments: { command: "node .agents/skills/testing/scripts/affected.mjs" },
    });
  assert.equal(retention(mixed)[0].keep, false);
});

test("terminal Claude usage replaces provisional output without counting cache twice", () => {
  const run = normalize([
    {
      type: "assistant",
      message: {
        id: "message",
        usage: { input_tokens: 2, output_tokens: 5, cache_read_input_tokens: 100 },
      },
    },
    {
      type: "result",
      usage: {
        input_tokens: 2,
        output_tokens: 429,
        cache_read_input_tokens: 100,
        cache_creation: { ephemeral_1h_input_tokens: 40 },
      },
    },
  ]);
  assert.deepEqual(run.tokens, {
    input: 2,
    output: 429,
    cached: 100,
    cacheWrite5m: 0,
    cacheWrite1h: 40,
  });
  assert.equal(run.usages.length, 1);
});

test("Codex patch events count as one tool call across start and completion", () => {
  const item = {
    id: "patch",
    type: "file_change",
    changes: [{ path: "src/api.ts", kind: "update" }],
  };
  const run = normalize([
    { type: "item.started", item },
    { type: "item.completed", item },
  ]);
  assert.equal(run.toolCalls.length, 1);
  assert.equal(run.toolCalls[0].name, "file_change");
  assert.deepEqual(run.toolCalls[0].arguments.changes, item.changes);
});

test("terminal totals never replace per-call contexts used by incident detectors", () => {
  const run = normalize([
    {
      type: "assistant",
      message: {
        id: "a",
        usage: { input_tokens: 2, output_tokens: 1, cache_read_input_tokens: 120000 },
      },
    },
    {
      type: "assistant",
      message: {
        id: "b",
        usage: { input_tokens: 2, output_tokens: 1, cache_read_input_tokens: 130000 },
      },
    },
    {
      type: "result",
      usage: { input_tokens: 4, output_tokens: 100, cache_read_input_tokens: 250000 },
    },
  ]);
  assert.equal(run.usages.length, 2);
  assert.equal(run.usages[0].cache_read_input_tokens, 120000);
  assert.equal(run.tokens.output, 100);
});

test("independent acceptance tests reject missing features and unsafe retry behavior", async () => {
  const fixture = await createFixture("none");
  try {
    for (const id of ["boundary", "retry"]) {
      await writeFile(path.join(fixture.cwd, ".acceptance.test.ts"), acceptance[id]);
      const result = command(fixture.cwd, process.execPath, ["--test", ".acceptance.test.ts"]);
      assert.equal(result.status, 1, id);
      assert.match(result.stdout, /summary is not a function|ERR_ASSERTION/u);
    }
    await writeFile(path.join(fixture.cwd, ".acceptance.test.ts"), acceptance.duplication);
    assert.equal(command(fixture.cwd, process.execPath, ["--test", ".acceptance.test.ts"]).status, 0);
    const shipping = path.join(fixture.cwd, "src/shipping.ts");
    await writeFile(
      shipping,
      (await readFile(shipping, "utf8")).replace(
        "carrier.createLabel({ orderId: id, idempotencyKey: `ship:${id}` })",
        "carrier.createLabel({ orderId: id, idempotencyKey: `ship:${id}` }).pipe(Effect.retry({ times: 2, while: (error) => error.retryable }))",
      ),
    );
    await writeFile(path.join(fixture.cwd, ".acceptance.test.ts"), acceptance.retry);
    assert.equal(command(fixture.cwd, process.execPath, ["--test", ".acceptance.test.ts"]).status, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("fixture starts green and independent regression oracle rejects its seeded bug", async () => {
  const fixture = await createFixture("none");
  try {
    assert.equal(command(fixture.cwd, process.execPath, ["check.mjs", "full"]).status, 0);
    await writeFile(path.join(fixture.cwd, ".acceptance.test.ts"), acceptance.regression);
    const red = command(fixture.cwd, process.execPath, ["--test", ".acceptance.test.ts"]);
    assert.equal(red.status, 1);
    assert.match(red.stdout, /1600|ERR_ASSERTION/u);
    const file = path.join(fixture.cwd, "src/pricing.ts");
    await writeFile(file, (await readFile(file, "utf8")).replace("cents * percent", "cents * (100 - percent)"));
    assert.equal(command(fixture.cwd, process.execPath, ["--test", ".acceptance.test.ts"]).status, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("real graders detect baseline duplication and a new dead export and count added files", async () => {
  const fixture = await createFixture("none");
  try {
    const base = git(fixture.cwd, "rev-parse", "HEAD");
    const before = await metrics(fixture.cwd, base);
    assert.equal(before.testsPass, true);
    assert.ok(before.duplicatedLines > 0);
    assert.ok(before.findings > 0);
    assert.ok(before.cyclomaticTotal > 0);
    await writeFile(path.join(fixture.cwd, "src/unused.ts"), "export const unused = 42;\n");
    await writeFile(
      path.join(fixture.cwd, "src/pricing.ts"),
      (await readFile(path.join(fixture.cwd, "src/pricing.ts"), "utf8")) + "\nexport const unusedExport = 42;\n",
    );
    git(fixture.cwd, "add", "-N", "--", "src");
    const after = await metrics(fixture.cwd, base);
    assert.ok(after.deadExports > before.deadExports);
    assert.equal(after.added, 3);
  } finally {
    await fixture.cleanup();
  }
});

test("judge refuses missing, duplicate or nonexistent line citations", () => {
  const final = { "src/api.ts": "const value = 1;\n" };
  const value = {
    rules: ruleNames.map((rule) => ({
      rule,
      score: 2,
      file: "src/api.ts",
      line: 1,
      reason: "evidence",
    })),
  };
  assert.equal(validateJudgment(value, final), value);
  assert.throws(() => validateJudgment({ rules: [] }, final), /Missing/u);
  assert.throws(
    () => validateJudgment({ rules: value.rules.map((rule) => ({ ...rule, line: 99 })) }, final),
    /Invalid/u,
  );
  assert.throws(() => validateJudgment({ rules: value.rules.map(() => value.rules[0]) }, final), /Invalid/u);
});

test("summary includes cache and censored failures, never turns missing judges into zero", () => {
  const result = summarize([
    {
      suite: "shape",
      provider: "claude",
      condition: "none",
      seed: 1,
      id: "regression",
      grade: { pass: false },
      usd: 0.1,
      run: {
        status: "budget",
        usages: [{}],
        tokens: { input: 10, output: 20, cached: 30, cacheWrite5m: 40, cacheWrite1h: 50 },
        toolCalls: [{}],
      },
    },
  ]);
  assert.equal(result.conditions[0].passRate, 0);
  assert.equal(result.conditions[0].tokens, 150);
  assert.equal(result.conditions[0].cacheTokens, 120);
  assert.equal(result.conditions[0].scores.boundaries, null);
  assert.equal(result.conditions[0].meteredRuns, 1);
  const unknown = summarize([
    {
      suite: "shape",
      provider: "codex",
      condition: "none",
      grade: { pass: false },
      usd: 0.32,
      run: {
        status: "timeout",
        usages: [],
        tokens: { input: 0, output: 0, cached: 0 },
        toolCalls: [],
      },
    },
  ]);
  assert.equal(unknown.conditions[0].tokens, null);
  assert.equal(unknown.conditions[0].meteredRuns, 0);
  assert.equal(unknown.conditions[0].usd, 0.32);
});
