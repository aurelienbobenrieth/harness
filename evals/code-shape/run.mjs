/* eslint-disable no-await-in-loop -- Fixed trial order and one shared ledger bound paid runs. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runAgent, judge, budget } from "../lib/runner.mjs";
import { root, options, results, skillsRevision } from "../lib/io.mjs";
import { runTask } from "../lib/behavior.mjs";
import { tasks as economy } from "../economy/tasks.mjs";
import { tasks as quality } from "../quality/tasks.mjs";
import { tasks } from "./tasks.mjs";
import { createFixture, sources, git } from "./fixture.mjs";
import { deterministic, rubric, validateJudgment } from "./grade.mjs";
import { summarize } from "./report.mjs";
import { regrade } from "./regrade.mjs";
import { writeReport } from "./write-report.mjs";

const opts = options();

if (opts.regrade) {
  await regrade(opts.regrade, opts["prior-usd"]);
  process.exit(0);
}

if (opts.report) {
  await writeReport(opts.report, opts.raw);
  process.exit(0);
}

if (!opts.scripted) throw Error("--scripted <candidate commit> is required");
if (budget.limit > 15) throw Error("This experiment has a hard $15 ceiling");
const refs = { none: "none", prose: opts.prose ?? "9bd621e", scripted: opts.scripted };
const revisions = Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, skillsRevision(ref)]));
const rows = opts.resume
  ? (await readFile(opts.resume, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse)
  : [];

budget.spent = Number(opts["prior-usd"] ?? 0) + rows.reduce((sum, row) => sum + (row.usd ?? 0), 0);
const output = await results("code-shape");

for (const row of rows) await output.record(row);
const trials = Number(opts.seeds ?? 2);

if (!Number.isInteger(trials) || trials < 1) throw Error("Invalid repetitions");
const plan = [];

// Interleave conditions and reverse them on the second repetition to reduce time/order confounding.
for (const task of [...tasks, ...economy, ...quality]) {
  for (let seed = 1; seed <= trials; seed++) {
    for (const provider of ["claude", "codex"]) {
      for (const condition of seed % 2
        ? task.suite
          ? ["prose", "scripted"]
          : ["none", "prose", "scripted"]
        : task.suite
          ? ["scripted", "prose"]
          : ["scripted", "prose", "none"])
        plan.push({ suite: task.suite ?? "shape", provider, task, condition, seed });
    }
  }
}

const key = (row) => `${row.suite}/${row.provider}/${row.id ?? row.task.id}/${row.condition}/${row.seed}`;
const done = new Set(rows.map(key));
let failure;
let recording = Promise.resolve();

async function executeTrial(trial) {
  const { task, provider, condition, seed, suite } = trial;
  const ref = refs[condition];
  const model = provider === "claude" ? "claude-haiku-5-5" : "gpt-6-luna";
  let row;

  try {
    // Reserve enough for a full case before starting it. Judge calls also use the same guard.
    const allowance = suite === "shape" ? Number(opts["shape-usd"] ?? 0.32) : Number(opts["case-usd"] ?? 0.12);

    if (budget.spent + budget.reserved + allowance + (suite === "shape" ? 0.055 : 0.08) > budget.limit)
      throw Error("Insufficient remaining shared budget for the next case");

    if (suite !== "shape") {
      const result = await runTask(task, {
        provider,
        model,
        "skills-ref": ref,
        seed,
        turns: 40,
        "case-usd": allowance,
      });

      row = {
        ...result,
        provider,
        condition,
        suite,
        usd: result.run.costEstimateUsd + (result.judgment?.costEstimateUsd ?? 0),
      };
    } else {
      const fixture = await createFixture(ref);

      try {
        const cwd = fixture.cwd;
        const base = git(cwd, "rev-parse", "HEAD");
        const original = {
          files: await sources(cwd),
          check: await readFile(path.join(cwd, "check.mjs"), "utf8"),
          package: await readFile(path.join(cwd, "package.json"), "utf8"),
        };
        const run = await runAgent({
          provider,
          model,
          cwd,
          prompt: `${task.prompt}\nWork only in this disposable fixture. Use the preinstalled Effect 4 package. Do not access network, install packages, publish, commit, or spawn paid models. Project commands: node check.mjs scoped, then node check.mjs full. Trial ${seed}.`,
          writable: true,
          maxTurns: 55,
          timeoutMs: 300000,
          maxUsd: allowance,
        });
        const grade = await deterministic(cwd, task, original, base);

        grade.pass &&= run.status === "completed";
        let judgment, judgeError;

        try {
          judgment = await judge({
            rubric,
            input: {
              task: task.prompt,
              original: original.files,
              diff: grade.diff,
              final: grade.final,
            },
            maxUsd: 0.055,
            timeoutMs: 60000,
          });

          validateJudgment(judgment.value, grade.final);
        } catch (error) {
          judgeError = error.message;
          judgment = error.run ? { run: error.run } : judgment;
        }

        row = {
          id: task.id,
          provider,
          condition,
          suite,
          seed,
          skillsRef: ref,
          skillsRevision: revisions[condition],
          run,
          grade,
          judgment,
          judgeError,
          usd: run.costEstimateUsd + (judgment?.run?.costEstimateUsd ?? 0),
        };
      } finally {
        await fixture.cleanup();
      }
    }

    rows.push(row);
    recording = recording.then(() => output.record(row));
    await recording;
    console.log(`${key(row)} ${row.grade.pass ? "PASS" : "FAIL"} ${row.run.status} $${budget.spent.toFixed(4)}`);
    if (row.run.status === "error")
      throw Error(
        `Provider error: ${row.run.stderr || JSON.stringify(row.run.events.filter((event) => event.type === "error" || event.type === "turn.failed" || event.is_error))}`,
      );
  } catch (error) {
    failure = error.message;
  }
}

const pending = plan
  .filter((trial) => !done.has(key(trial)))
  .slice(0, opts.limit ? Math.max(0, Number(opts.limit) - rows.length) : undefined);
const concurrency = Number(opts.concurrency ?? 3);

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw Error("Concurrency must be 1-8");

for (let index = 0; index < pending.length; index += concurrency) {
  if (failure) break;
  await Promise.all(pending.slice(index, index + concurrency).map(executeTrial));
}

const summary = summarize(rows);

summary.expected = plan.length;
summary.completed = rows.length;
summary.spent = budget.spent;
summary.incomplete = failure ?? null;
summary.revisions = revisions;
await mkdir(path.join(root, "evals/results/code-shape"), { recursive: true });
await writeFile(path.join(root, "evals/results/code-shape/measurements.json"), JSON.stringify(summary, null, 2) + "\n");

await writeFile(
  path.join(root, "evals/results/code-shape/evidence.json"),
  JSON.stringify(
    rows.map((row) => ({
      suite: row.suite,
      provider: row.provider,
      condition: row.condition,
      seed: row.seed,
      task: row.id,
      status: row.run.status,
      pass: row.grade.pass,
      usd: row.usd,
      tokens: row.run.tokens,
      metered: row.run.usages.length > 0 || row.run.events.some((event) => event.type === "result" && event.usage),
      calls: row.run.toolCalls.length,
      durationMs: row.run.durationMs,
      helperCalls: row.run.toolCalls.filter((call) =>
        /scripts[\\/]+(?:draft|affected|check)\.mjs/u.test(JSON.stringify(call.arguments)),
      ),
      metrics: row.grade.measured ? { ...row.grade.measured, raw: undefined } : undefined,
      judgment: row.judgeError ? null : row.judgment?.value,
      judgeError: row.judgeError,
      diff: row.grade.diff,
      final: row.grade.final,
    })),
    null,
    2,
  ) + "\n",
);

await output.summary(JSON.stringify(summary, null, 2));

console.log(
  JSON.stringify({
    file: output.base,
    completed: rows.length,
    expected: plan.length,
    spent: budget.spent,
    incomplete: summary.incomplete,
  }),
);

process.exitCode = failure || rows.length < plan.length ? 2 : 0;
