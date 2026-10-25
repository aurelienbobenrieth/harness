import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fixture, results, skillsRevision, files } from "./io.mjs";
import { runAgent, judge, budget } from "./runner.mjs";
import { grade } from "../quality/grade.mjs";
import { tasks as economy } from "../economy/tasks.mjs";
import { tasks as quality } from "../quality/tasks.mjs";
const tasks = [...economy, ...quality];
async function runTask(task, opts) {
  const workspace = await fixture("behavior", opts["skills-ref"]);
  try {
    const cwd = workspace.cwd;
    if (task.id === "git") {
      const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
      git("init", "-q");
      git("config", "user.name", "Eval Fixture");
      git("config", "user.email", "eval@example.invalid");
      git("add", "--", "calc.mjs", "README.md");
      git("commit", "-qm", "fix: add discount calculation");
      await writeFile(
        path.join(cwd, "calc.mjs"),
        "export const discount = (price, percent) => price - price * percent / 100;\n",
      );
      await writeFile(
        path.join(cwd, "calc.test.mjs"),
        "import test from 'node:test';import assert from 'node:assert/strict';import {discount} from './calc.mjs';test('returns remaining price',()=>assert.equal(discount(100,20),80));\n",
      );
    }
    const original = await readFile(path.join(cwd, "calc.mjs"), "utf8");
    await writeFile(path.join(cwd, "title.txt"), "Arthmetic\n");
    await mkdir(path.join(cwd, "adapters"));
    for (let i = 0; i < 8; i++) {
      await writeFile(path.join(cwd, `adapters/adapter-${i}.mjs`), `export const parse = x => Number(x);\n`);
      await writeFile(
        path.join(cwd, `adapters/adapter-${i}.test.mjs`),
        `import test from 'node:test';import assert from 'node:assert/strict';import {parse} from './adapter-${i}.mjs';test('finite validation',()=>{assert.equal(parse('2'),2);assert.throws(()=>parse('no'),TypeError)});\n`,
      );
    }
    const before = (await readdir(cwd)).toSorted().join();
    const contents = new Map();
    if (task.id === "owner") for (const file of await files(cwd)) contents.set(file, await readFile(file, "utf8"));
    const checkSource = await readFile(path.join(cwd, "check.mjs"), "utf8");
    const run = await runAgent({
      provider: opts.provider ?? "claude",
      model: opts.model,
      cwd,
      prompt:
        task.prompt +
        `\nTrial seed: ${opts.seed ?? 1}. Work only in this disposable fixture. Do not access network, publish, or spawn paid models.`,
      writable: true,
      mcpServer: task.id === "broad" ? path.join(cwd, "delegate.mjs") : undefined,
      maxTurns: Number(opts.turns ?? 24),
      timeoutMs: 180000,
      maxUsd: Number(opts["case-usd"] ?? 0.15),
      observe: () => ({
        source: existsSync(path.join(cwd, "calc.mjs")) ? readFileSync(path.join(cwd, "calc.mjs"), "utf8") : null,
        test: existsSync(path.join(cwd, "calc.test.mjs"))
          ? readFileSync(path.join(cwd, "calc.test.mjs"), "utf8")
          : null,
      }),
    });
    const artifacts = { original };
    for (const name of ["commit.txt", "pr.txt", "title.txt", "decision.txt", "brief.txt"]) {
      const file = path.join(cwd, name);
      if (existsSync(file)) artifacts[name] = await readFile(file, "utf8");
    }
    const journalFile = path.join(cwd, ".evidence.jsonl");
    artifacts.journal = existsSync(journalFile)
      ? (await readFile(journalFile, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse)
      : [];
    // Cross-check recorded source against event-time snapshots, not agent claims.
    artifacts.journal = artifacts.journal.filter((e) =>
      run.events.some((event) => event.observation?.source === e.source),
    );
    artifacts.checkUnchanged = (await readFile(path.join(cwd, "check.mjs"), "utf8")) === checkSource;
    const direct = [];
    for (const event of run.events) {
      const blocks = event.message?.content ?? [];
      const output =
        event.item?.aggregated_output ??
        (Array.isArray(blocks)
          ? blocks
              .filter((b) => b.type === "tool_result")
              .map((b) => (typeof b.content === "string" ? b.content : JSON.stringify(b.content)))
              .join("\n")
          : "");
      if (
        event.observation?.test &&
        /(?:tests?|pass|fail|ERR_ASSERTION|AssertionError)/i.test(output) &&
        /(?:# tests|tests? [0-9]|ERR_ASSERTION|AssertionError)/i.test(output)
      )
        direct.push({
          scope: "direct",
          source: event.observation.source,
          test: event.observation.test,
          status: /ERR_ASSERTION|AssertionError|# fail [1-9]/.test(output) ? 1 : 0,
          output,
        });
    }
    artifacts.direct = direct;
    const finalSource = await readFile(path.join(cwd, "calc.mjs"), "utf8");
    try {
      const r = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import {discount} from "./calc.mjs";process.exit(discount(100,20)===80&&discount(50,10)===45?0:1)`,
        ],
        { cwd, timeout: 5000 },
      );
      artifacts.fixed = r.status === 0;
    } catch {
      artifacts.fixed = false;
    }
    artifacts.unrelated =
      (await readdir(cwd))
        .filter((n) => n !== "decision.txt")
        .toSorted()
        .join() !== before || finalSource !== original;
    if (task.id === "owner")
      for (const [file, content] of contents)
        if (!existsSync(file) || (await readFile(file, "utf8")) !== content) artifacts.unrelated = true;
    let judgment;
    if (task.id === "broad") {
      const preliminary = grade(task.id, run, artifacts);
      if (preliminary.brief) {
        const result = await judge({
          rubric:
            'Return {"pass":boolean}. A good delegation brief has a concrete GOAL, DONE-WHEN with named checks, and a bounded BUDGET; owns the adapter scope, forbids unrelated edits, is understandable standalone. Judge only brief quality.',
          input: preliminary.brief,
          maxUsd: 0.08,
        });
        artifacts.briefQuality = result.value.pass === true;
        judgment = result.run;
      }
    }
    return {
      id: task.id,
      suite: task.suite,
      skillsRef: opts["skills-ref"] ?? "working-tree",
      skillsRevision: skillsRevision(opts["skills-ref"]),
      seed: Number(opts.seed ?? 1),
      grade:
        run.status === "completed"
          ? grade(task.id, run, artifacts)
          : { ...grade(task.id, run, artifacts), pass: false, incomplete: run.status },
      run,
      judgment,
      artifacts,
    };
  } finally {
    await workspace.cleanup();
  }
}
function summarize(rows) {
  const groups = Map.groupBy(rows, (r) => `${r.run.provider}/${r.run.model}/${r.skillsRef}`);
  return [...groups].map(([condition, rs]) => ({
    condition,
    runs: rs.length,
    passed: rs.filter((r) => r.grade.pass).length,
    passRate: rs.filter((r) => r.grade.pass).length / rs.length,
    toolCalls: rs.reduce((s, r) => s + r.run.toolCalls.length, 0),
    tokens: rs.reduce((s, r) => s + Object.values(r.run.tokens).reduce((a, b) => a + b, 0), 0),
    usd: rs.reduce((s, r) => s + r.run.costEstimateUsd + (r.judgment?.costEstimateUsd ?? 0), 0),
  }));
}
export async function runSuite(suite, opts) {
  const output = await results(suite),
    rows = [];
  const selected = tasks.filter(
    (t) => (suite === "ab" || t.suite === suite) && (!opts.tasks || opts.tasks.split(",").includes(t.id)),
  );
  if (!selected.length) throw new Error("No tasks selected");
  const refs =
    suite === "ab"
      ? (opts.refs ?? "origin/steering/economy,origin/skills/terse,none").split(",")
      : [opts["skills-ref"]];
  const seeds = Number(opts.seeds ?? (suite === "ab" ? 3 : 1));
  if (!Number.isInteger(seeds) || seeds < 1) throw new Error("Invalid seeds");
  let failure;
  try {
    for (const ref of refs)
      for (let seed = 1; seed <= seeds; seed++)
        for (const task of selected) {
          const row = await runTask(task, { ...opts, "skills-ref": ref, seed });
          rows.push(row);
          await output.record(row);
          console.log(
            `${suite} ${ref} ${seed} ${task.id}: ${row.grade.pass ? "PASS" : "FAIL"} (${row.run.status}) $${budget.spent.toFixed(4)}`,
          );
          if (row.run.status === "error") throw new Error(row.run.stderr || "Agent error");
        }
  } catch (error) {
    failure = error.message;
    await output.record({ error: failure, run: error.run });
  }
  const summary = {
    suite,
    conditions: summarize(rows),
    spent: budget.spent,
    incomplete: failure ?? null,
  };
  await output.summary(JSON.stringify(summary, null, 2));
  await output.record({ summary });
  console.log(JSON.stringify(summary));
  process.exitCode = failure ? 2 : rows.some((r) => !r.grade.pass) ? 1 : 0;
  return summary;
}
