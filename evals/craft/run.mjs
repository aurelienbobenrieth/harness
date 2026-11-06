import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { measure } from "./measure.mjs";
import { tasks } from "./tasks.mjs";
import { fixture, options, results, skillsRevision } from "../lib/io.mjs";
import { budget, runAgent } from "../lib/runner.mjs";

/** Same specs under one skills ref; held-out tasks run only when asked for by name. */
const opts = options();
const provider = opts.provider ?? "claude";
const selected = tasks.filter((task) => (opts.tasks ? opts.tasks.split(",").includes(task.id) : !task.heldOut));
const seeds = Number(opts.seeds ?? 2);
const output = await results(`craft/${opts.arm ?? "default"}`);
const rows = [];

for (let seed = 1; seed <= seeds; seed++)
  for (const task of selected) {
    const workspace = await fixture("craft", opts["skills-ref"]);
    try {
      for (const [file, text] of Object.entries(task.files)) {
        await mkdir(path.dirname(path.join(workspace.cwd, file)), { recursive: true });
        await writeFile(path.join(workspace.cwd, file), text);
      }
      const run = await runAgent({
        provider,
        model: opts.model,
        cwd: workspace.cwd,
        prompt: `${task.prompt}\nEssai ${seed}. Fixture jetable, pas de réseau.`,
        writable: true,
        maxTurns: Number(opts.turns ?? 40),
        timeoutMs: Number(opts["timeout-ms"] ?? 360000),
        maxUsd: Number(opts["case-usd"] ?? 1.2),
        reasoningEffort: opts.effort ?? "medium",
      });
      const measured = await measure(task, workspace.cwd);
      const row = {
        id: task.id,
        arm: opts.arm,
        seed,
        provider,
        skillsRevision: skillsRevision(opts["skills-ref"]),
        status: run.status,
        ...measured,
        skillLoads: run.skillLoads?.map((load) => load.skill),
        tools: run.toolCalls?.length,
        tokens: run.tokens,
        cost: run.costEstimateUsd,
        durationMs: run.durationMs,
      };
      rows.push(row);
      await output.record(row);
      const m = row.metrics;
      console.log(
        `${seed} ${task.id} accepted=${m.accepted} src=${m.sourceLines} test=${m.testLines} exports=${m.exports} safe=${m.refactorSafe} mut=${m.mutation?.toFixed(2)} reused=${m.reused} implicit=${m.implicit} (${run.status}) $${budget.spent.toFixed(2)}`,
      );
    } finally {
      await workspace.cleanup().catch((error) => {
        if (error.code !== "EBUSY") throw error;
      });
    }
  }

const mean = (pick) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
const summary = {
  arm: opts.arm,
  provider,
  runs: rows.length,
  accepted: rows.filter((row) => row.metrics.accepted).length,
  sourceLines: mean((row) => row.metrics.sourceLines),
  testLines: mean((row) => row.metrics.testLines),
  mutation: mean((row) => row.metrics.mutation ?? 0),
  refactorSafe: rows.filter((row) => row.metrics.refactorSafe).length,
  implicit: mean((row) => row.metrics.implicit),
  seconds: mean((row) => row.durationMs) / 1000,
  spent: budget.spent,
};
await output.record({ summary });
await output.summary(JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
