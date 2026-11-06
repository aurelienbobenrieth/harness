import { readFile } from "node:fs/promises";
import path from "node:path";
import { installScenario, scoreReply, turns } from "./scenario.mjs";
import { fixture, options, results, skillsRevision } from "../lib/io.mjs";
import { answer } from "../quality/grade.mjs";
import { budget, runAgent } from "../lib/runner.mjs";

/** Plays the scripted conversation in one resumed session, with one simulated context hand-off. */
const opts = options();
const provider = opts.provider ?? "claude";
const seeds = (opts.seeds ?? "1").split(",");
const inject = opts.inject === "on";
const output = await results(`long/${opts.arm ?? "default"}`);
const guardrail =
  "Fixture jetable : pas de réseau, pas de publication. Les serveurs locaux sont permis, n'en laisse aucun tourner.";

async function session(seed) {
  const workspace = await fixture("long", opts["skills-ref"]);
  const rows = [];
  try {
    await installScenario(workspace.cwd);
    let sessionId;
    // Both CLIs report cumulative cost on a resumed session.
    let priorCostUsd = 0;
    let carried = `${guardrail} Essai ${seed}.\n\n`;
    const ask = async (prompt) => {
      const decisions = inject ? await readFile(path.join(workspace.cwd, "DECISIONS.md"), "utf8").catch(() => "") : "";
      const run = await runAgent({
        provider,
        model: opts.model,
        cwd: workspace.cwd,
        prompt: decisions ? `Décisions en vigueur :\n${decisions}\n\n${prompt}` : prompt,
        persist: true,
        resume: sessionId,
        priorCostUsd,
        writable: true,
        maxTurns: Number(opts.turns ?? 30),
        timeoutMs: Number(opts["timeout-ms"] ?? 300000),
        maxUsd: Number(opts["turn-usd"] ?? 1.2),
        reasoningEffort: opts.effort ?? "medium",
      });
      sessionId = run.sessionId ?? sessionId;
      priorCostUsd = run.sessionCostUsd;
      return run;
    };
    for (const turn of turns) {
      if (turn.handoff) {
        const run = await ask(
          "Le contexte va être compacté. Écris le résumé de passation de cette conversation, pour la reprendre sans elle.",
        );
        carried = `Reprise d'une session précédente. Résumé de passation :\n\n${answer(run)}\n\n`;
        sessionId = undefined;
        priorCostUsd = 0;
        rows.push({ id: "handoff", cost: run.costEstimateUsd, status: run.status });
        continue;
      }
      const run = await ask(`${carried}${turn.prompt}`);
      carried = "";
      const reply = answer(run);
      const row = {
        id: turn.id,
        seed,
        arm: opts.arm,
        kind: turn.kind,
        status: run.status,
        reply,
        communication: scoreReply(turn, reply),
        outcome: turn.grade ? await turn.grade(workspace.cwd, run) : undefined,
        skillLoads: run.skillLoads?.map((load) => load.skill),
        tools: run.toolCalls?.length,
        tokens: run.tokens,
        cost: run.costEstimateUsd,
        durationMs: run.durationMs,
      };
      rows.push(row);
      await output.record(row);
      console.log(
        `${seed} ${turn.id} comm=${row.communication.pass} words=${row.communication.words}` +
          ` outcome=${row.outcome?.pass ?? "-"} (${run.status}) $${budget.spent.toFixed(2)}`,
      );
      if (run.status === "error") throw new Error(`${turn.id}: ${run.stderr.slice(-400)}`);
    }
  } finally {
    await workspace.cleanup().catch((error) => {
      if (error.code !== "EBUSY") throw error;
    });
  }
  return rows;
}

const all = [];
for (const seed of seeds) all.push(...(await session(seed)));
const scored = all.filter((row) => row.communication);
const outcomes = scored.filter((row) => row.outcome);
const summary = {
  arm: opts.arm,
  provider,
  skillsRevision: skillsRevision(opts["skills-ref"]),
  communication: `${scored.filter((row) => row.communication.pass).length}/${scored.length}`,
  outcomes: `${outcomes.filter((row) => row.outcome.pass).length}/${outcomes.length}`,
  failed: outcomes.filter((row) => !row.outcome.pass).map((row) => `${row.seed}:${row.id}`),
  spent: budget.spent,
};
await output.record({ summary });
await output.summary(JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
