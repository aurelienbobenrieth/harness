import { readFile } from "node:fs/promises";
import { tasks } from "./tasks.mjs";
import { runTask } from "../lib/behavior.mjs";
import { fixture, options, results, skillsRevision } from "../lib/io.mjs";
import { runAgent, budget } from "../lib/runner.mjs";
const opts = options(),
  output = await results("optimization"),
  rows = [];
const names = ["git", "communication", "build", "testing", "economy"];
const cases = (await readFile(new URL("../triggering/cases.jsonl", import.meta.url), "utf8"))
  .trim()
  .split("\n")
  .map(JSON.parse)
  .filter((c) => names.includes(c.expected));
cases.push(
  {
    id: "build-add-feature",
    expected: "build",
    prompt: "Add a feature: division that rejects zero divisors, exported from src/add.mjs.",
  },
  {
    id: "testing-add",
    expected: "testing",
    prompt: "Add tests for numeric addition in src/add.mjs.",
  },
  {
    id: "testing-flaky",
    expected: "testing",
    prompt: "Fix a flaky test for src/add.mjs by making its inputs deterministic.",
  },
);
let failure;
try {
  if (opts.resume) {
    const prior = (await readFile(opts.resume, "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse)
      .filter((r) => r.id && r.run);
    for (const row of prior) {
      if (
        row.skillsRevision !== skillsRevision(opts["skills-ref"]) ||
        row.run.provider !== (opts.provider ?? "claude")
      )
        throw new Error("Resume source/provider mismatch");
      rows.push(row);
      budget.spent += row.run.costEstimateUsd + (row.judgment?.costEstimateUsd ?? 0);
      await output.record(row);
    }
  }
  for (let seed = 1; seed <= Number(opts.seeds ?? 2); seed++) {
    if (opts.phase !== "behavior")
      for (const c of cases) {
        if (rows.some((r) => r.id === c.id && r.seed === seed && r.phase === "trigger")) continue;
        const f = await fixture("tiny", opts["skills-ref"]);
        try {
          const run = await runAgent({
            provider: opts.provider ?? "claude",
            model: opts.model,
            cwd: f.cwd,
            prompt: c.prompt,
            maxTurns: 4,
            stopOnSkill: c.mode !== "always-on",
            writable: process.platform === "win32",
            maxUsd: Number(opts["trigger-usd"] ?? 0.05),
            timeoutMs: 90000,
          });
          const row = {
            id: c.id,
            skill: c.expected,
            phase: "trigger",
            seed,
            skillsRef: opts["skills-ref"],
            skillsRevision: skillsRevision(opts["skills-ref"]),
            mode: c.mode,
            pass: run.skillLoads[0]?.skill?.split(":").at(-1) === c.expected,
            run,
          };
          rows.push(row);
          await output.record(row);
          console.log(`${seed} trigger ${c.id} ${row.pass} $${budget.spent.toFixed(4)}`);
          if (["error", "timeout", "budget"].includes(run.status))
            throw new Error(`${c.id}: ${run.status}: ${run.stderr}`);
        } finally {
          await f.cleanup();
        }
      }
    if (opts.phase !== "trigger")
      for (const task of tasks.filter((t) => !opts.tasks || opts.tasks.split(",").includes(t.id))) {
        if (rows.some((r) => r.id === task.id && r.seed === seed && r.phase === "behavior"))
          continue;
        const row = {
          ...(await runTask(task, { ...opts, seed })),
          skill: task.skill,
          phase: "behavior",
        };
        rows.push(row);
        await output.record(row);
        console.log(
          `${seed} behavior ${task.id} ${row.grade.pass} (${row.run.status}) $${budget.spent.toFixed(4)}`,
        );
        if (["error", "timeout", "budget"].includes(row.run.status))
          throw new Error(`${task.id}: ${row.run.status}: ${row.run.stderr}`);
      }
  }
} catch (e) {
  failure = e.message;
  await output.record({ error: failure, run: e.run });
}
const summary = {
  ref: opts["skills-ref"],
  revision: skillsRevision(opts["skills-ref"]),
  provider: opts.provider ?? "claude",
  runs: rows.length,
  spent: budget.spent,
  incomplete: failure ?? null,
  skills: names.map((skill) => ({
    skill,
    behavior: rows
      .filter((r) => r.skill === skill && r.phase === "behavior")
      .map((r) => ({ id: r.id, seed: r.seed, pass: r.grade.pass })),
    loads: rows
      .filter((r) => r.skill === skill && r.phase === "trigger" && r.mode !== "always-on")
      .map((r) => r.pass),
  })),
};
await output.record({ summary });
await output.summary(JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
process.exitCode = failure ? 2 : 0;
