import { mkdir } from "node:fs/promises";
import path from "node:path";
import { contractFamily } from "./contract-family.mjs";
import { heldOut } from "./held-out.mjs";
import { alignFamily, retrospectFamily } from "./retrospect-family.mjs";
import { skillValue } from "./skill-value.mjs";
import { weakness } from "./weakness.mjs";
import { installTrap, traps } from "./tasks.mjs";
import { fixture, options, results, skillsRevision } from "../lib/io.mjs";
import { budget, runAgent } from "../lib/runner.mjs";

/** Runs friction traps under one arm: a skills ref, optionally with deterministic mechanisms installed. */
const opts = options();
const provider = opts.provider ?? "claude";
const pool =
  {
    "held-out": heldOut,
    "skill-value": skillValue,
    weakness,
    contract: contractFamily,
    retrospect: retrospectFamily,
    align: alignFamily,
  }[opts.pool] ?? traps;
const selected = pool.filter((trap) => !opts.traps || opts.traps.split(",").includes(trap.id));
const seeds = Number(opts.seeds ?? 1);
const mechanical = opts.mechanical === "on";
const output = await results(`traps/${opts.arm ?? "default"}`);
const rows = [];
const prefix = opts.prefix ? opts.prefix + " " : "";

for (let seed = 1; opts.mode !== "backlog" && seed <= seeds; seed++) {
  for (const trap of selected) {
    if (mechanical && !trap.mechanism) continue;
    const workspace = await fixture("traps", opts["skills-ref"]);
    try {
      await installTrap(trap, workspace.cwd, mechanical);
      const run = await runAgent({
        provider,
        model: opts.model,
        cwd: workspace.cwd,
        prompt: `${prefix}${trap.prompt}\nTrial seed: ${seed}. Work only in this disposable fixture. Local servers on localhost are fine; do not access the network, publish, or spawn paid models.`,
        writable: true,
        maxTurns: Number(opts.turns ?? 30),
        timeoutMs: Number(opts["timeout-ms"] ?? 240000),
        maxUsd: Number(opts["case-usd"] ?? 1),
        reasoningEffort: opts.effort ?? "medium",
      });
      const verdict = await trap.grade(workspace.cwd, run);
      const row = {
        id: trap.id,
        arm: opts.arm,
        mechanical,
        seed,
        skillsRef: opts["skills-ref"],
        skillsRevision: skillsRevision(opts["skills-ref"]),
        grade: run.status === "completed" ? verdict : { ...verdict, incomplete: run.status },
        run,
      };
      rows.push(row);
      await output.record(row);
      console.log(`${seed} ${trap.id} ${verdict.pass} (${run.status}) $${budget.spent.toFixed(3)}`);
      if (run.status === "error") throw new Error(`${trap.id}: ${run.stderr}`);
    } finally {
      // A server the agent left running holds the folder on Windows; the trial is already recorded.
      await workspace.cleanup().catch((error) => {
        if (error.code !== "EBUSY") throw error;
      });
    }
  }
}
/** Every ticket in one run: attention and context pressure, the conditions real failures came from. */
async function backlog(seed) {
  const workspace = await fixture("traps", opts["skills-ref"]);
  try {
    for (const trap of selected) {
      const folder = path.join(workspace.cwd, "tickets", trap.id);
      await mkdir(folder, { recursive: true });
      await installTrap(trap, folder, mechanical);
    }
    const tickets = selected.map((trap) => `## ${trap.id}\n\n${trap.prompt}`).join("\n\n");
    const run = await runAgent({
      provider,
      model: opts.model,
      cwd: workspace.cwd,
      prompt: `${prefix}Backlog de la nuit : traite tous les tickets ci-dessous, seul, je ne suis pas disponible. Les fichiers de chaque ticket sont dans tickets/<id>/ et ses commandes et chemins sont relatifs à ce dossier. Ne laisse aucun serveur tourner. Termine par un rapport court, ticket par ticket.

${tickets}

Trial seed: ${seed}. Work only in this disposable fixture. Local servers on localhost are fine; do not access the network, publish, or spawn paid models.`,
      writable: true,
      maxTurns: Number(opts.turns ?? 160),
      timeoutMs: Number(opts["timeout-ms"] ?? 1200000),
      maxUsd: Number(opts["case-usd"] ?? 5),
      reasoningEffort: opts.effort ?? "medium",
    });
    for (const trap of selected) {
      const verdict = await trap.grade(path.join(workspace.cwd, "tickets", trap.id), run);
      const row = {
        id: trap.id,
        arm: opts.arm,
        mechanical,
        seed,
        mode: "backlog",
        skillsRef: opts["skills-ref"],
        grade: verdict,
        status: run.status,
      };
      rows.push({ ...row, run });
      await output.record(row);
      console.log(`${seed} ${trap.id} ${verdict.pass} (${run.status}) $${budget.spent.toFixed(3)}`);
    }
    await output.record({ backlogRun: run, seed });
    if (run.status === "error") throw new Error(run.stderr);
  } finally {
    await workspace.cleanup().catch((error) => {
      if (error.code !== "EBUSY") throw error;
    });
  }
}
if (opts.mode === "backlog") for (let seed = 1; seed <= seeds; seed++) await backlog(seed);

const summary = {
  arm: opts.arm,
  provider,
  runs: rows.length,
  passed: rows.filter((r) => r.grade.pass).length,
  spent: budget.spent,
};
await output.record({ summary });
await output.summary(JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
