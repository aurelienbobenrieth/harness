import test from "node:test";
import assert from "node:assert/strict";
import { normalize, estimateCost } from "./transcript.mjs";
import { CostGuard, runAgent } from "./runner.mjs";
import { fixture } from "./io.mjs";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { metrics } from "../triggering/metrics.mjs";

test("a Muse stream yields its skill loads, tools, usage and final message", () => {
  const { skillLoads, toolCalls, tokens, messages } = normalize([
    { payload_type: "task.lifecycle.proposed", payload: { task_id: "a", event: { task_kind: "tool.read_skill" } } },
    { payload_type: "task.lifecycle.proposed", payload: { task_id: "b", event: { task_kind: "model.meta.response" } } },
    { payload_type: "tool.result", payload: { call_id: "a", text: '<read-skill-result name="build" status="ok">' } },
    { payload_type: "tool.result", payload: { call_id: "c", text: '<read-skill-result name="git" status="error">' } },
    {
      payload_type: "run.usage",
      payload: { models: [{ input_tokens: 100, cached_tokens: 40, output_tokens: 5 }] },
    },
    { payload_type: "run.terminal.completed", payload: { text: "done" } },
  ]);
  assert.deepEqual(
    skillLoads.map((load) => load.skill),
    ["build"],
  );
  assert.deepEqual(
    toolCalls.map((call) => call.name),
    ["tool.read_skill"],
  );
  assert.deepEqual([tokens.input, tokens.cached, tokens.output], [60, 40, 5]);
  assert.equal(messages.at(-1).content, "done");
});

test("Muse refuses a run it could not finish headless", async () => {
  await assert.rejects(runAgent({ provider: "muse", model: "m", cwd: ".", prompt: "x" }), /fresh writable run/);
});

test("only actual skill calls and reads count as loads; command start and completion deduplicate", () => {
  const events = [
    {
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Glob", input: { pattern: "skills/build/SKILL.md" } },
          { type: "tool_use", name: "Skill", input: { skill: "git" } },
        ],
      },
    },
    ...["item.started", "item.completed"].map((type) => ({
      type,
      item: { id: "read", type: "command_execution", command: "cat .agents/skills/build/SKILL.md" },
    })),
    {
      type: "turn.completed",
      usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 5 },
    },
  ];
  const run = normalize(events);

  assert.deepEqual(
    run.skillLoads.map((s) => s.skill),
    ["git", "build"],
  );

  assert.deepEqual(run.tokens, {
    input: 60,
    cached: 40,
    output: 5,
    cacheWrite5m: 0,
    cacheWrite1h: 0,
  });

  assert.equal(estimateCost(run.tokens, "gpt-6-luna"), 0.000235);
});

test("cost guard rejects an unaffordable next call before spawning", () => {
  const guard = new CostGuard(0.1);

  guard.spent = 0.09;
  assert.throws(() => guard.reserve(0.02), /Cost guard/);
  assert.throws(() => new CostGuard(0), /positive/);
});

test("concurrent reservations cannot oversubscribe the global allowance", () => {
  const guard = new CostGuard(0.1);
  const finish = guard.reserve(0.08);

  assert.throws(() => guard.reserve(0.03), /Cost guard/);
  finish(0.02);
  assert.equal(guard.spent, 0.02);
  guard.reserve(0.08);
});

test("streamed assistant fragments update usage without duplicating tool calls", () => {
  const events = [1, 20].map((output_tokens) => ({
    type: "assistant",
    message: {
      id: "one",
      usage: { input_tokens: 4, output_tokens },
      content: [{ type: "tool_use", id: "tool", name: "Skill", input: { skill: "git" } }],
    },
  }));
  const run = normalize(events);

  assert.equal(run.tokens.output, 20);
  assert.equal(run.skillLoads.length, 1);
});

test("fixture contains live skill bodies, verbatim core and both consumer discovery paths", async () => {
  const f = await fixture();

  try {
    const core = await readFile(new URL("../../skills/economy/core.md", import.meta.url), "utf8");

    assert.ok((await readFile(path.join(f.cwd, "AGENTS.md"), "utf8")).includes(core));

    assert.equal(
      await readFile(path.join(f.cwd, ".claude/skills/git/SKILL.md"), "utf8"),
      await readFile(path.join(f.cwd, ".agents/skills/git/SKILL.md"), "utf8"),
    );
  } finally {
    await f.cleanup();
  }
});

test("precision counts false positives and recall counts missing loads", () => {
  const m = metrics(
    [
      { expected: "git", predicted: "git" },
      { expected: null, predicted: "git" },
      { expected: "git", predicted: null },
    ],
    ["git"],
  );

  assert.deepEqual(m.perSkill[0], {
    skill: "git",
    tp: 1,
    fp: 1,
    fn: 1,
    precision: 0.5,
    recall: 0.5,
  });
});

test("runner reports CLI failure and kills a timed-out child", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "eval-runner-test-"));
  const old = process.env.EVALS_CODEX_BIN;

  process.env.EVALS_CODEX_BIN = process.execPath;

  try {
    // Node itself rejects the codex arguments, exercising the real process failure boundary.
    const failed = await runAgent({
      provider: "codex",
      cwd: dir,
      prompt: "test",
      guard: new CostGuard(1),
    });

    assert.equal(failed.status, "error");
    assert.notEqual(failed.exitCode, 0);
    assert.equal(failed.costSource, "reserved-unmetered");
    assert.equal(failed.costEstimateUsd, 0.25);
    await writeFile(path.join(dir, "exec"), "setInterval(() => {}, 1000)");
    const timed = await runAgent({
      provider: "codex",
      cwd: dir,
      prompt: "test",
      timeoutMs: 100,
      guard: new CostGuard(1),
    });

    assert.equal(timed.status, "timeout");
    assert.equal(timed.costSource, "reserved-unmetered");
    assert.equal(timed.costEstimateUsd, 0.25);
  } finally {
    if (old === undefined) delete process.env.EVALS_CODEX_BIN;
    else process.env.EVALS_CODEX_BIN = old;
    await rm(dir, { recursive: true, force: true });
  }
});

test("Codex runner forwards medium effort and rejects invalid effort", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "eval-effort-test-"));
  const old = process.env.EVALS_CODEX_BIN;

  process.env.EVALS_CODEX_BIN = process.execPath;

  try {
    await writeFile(
      path.join(dir, "exec"),
      `console.log(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:JSON.stringify(process.argv)}}));console.log(JSON.stringify({type:"turn.completed",usage:{input_tokens:1,output_tokens:1}}));`,
    );

    const run = await runAgent({
      provider: "codex",
      model: "gpt-6.1-sol",
      reasoningEffort: "medium",
      cwd: dir,
      prompt: "test",
      guard: new CostGuard(1),
    });

    assert.equal(run.status, "completed");
    assert.ok(JSON.parse(run.messages[0].content).includes('model_reasoning_effort="medium"'));
    await assert.rejects(runAgent({ provider: "codex", cwd: dir, reasoningEffort: "bogus" }), /Invalid reasoning/);
  } finally {
    if (old === undefined) delete process.env.EVALS_CODEX_BIN;
    else process.env.EVALS_CODEX_BIN = old;
    await rm(dir, { recursive: true, force: true });
  }
});
