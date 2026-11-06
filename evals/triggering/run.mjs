import { readFile } from "node:fs/promises";
import path from "node:path";
import { root, options, skills, fixture, results, skillsRevision } from "../lib/io.mjs";
import { runAgent, judge, budget } from "../lib/runner.mjs";
import { normalize } from "../lib/transcript.mjs";
import { answer } from "../quality/grade.mjs";
import { metrics } from "./metrics.mjs";

const opts = options(),
  inventory = await skills(opts["skills-ref"]),
  names = inventory.map((s) => s.name);
const cases = (await readFile(path.join(import.meta.dirname, "cases.jsonl"), "utf8"))
  .trim()
  .split("\n")
  .map(JSON.parse);
if (
  new Set(cases.map((c) => c.id)).size !== cases.length ||
  cases.some((c) => c.expected !== null && !names.includes(c.expected))
)
  throw new Error("Cases do not match installed skills; update labels for new/removed skills");
const selected = opts.limit ? cases.slice(0, Number(opts.limit)) : cases;
if (!selected.length || (opts.limit && (!Number.isInteger(Number(opts.limit)) || Number(opts.limit) < 1)))
  throw new Error("Limit must select at least one case");
const revision = skillsRevision(opts["skills-ref"]);
const output = await results(opts.static ? "triggering-static" : "triggering");
const rows = [];
let failure;
try {
  if (opts.resume) {
    if (opts.static) throw new Error("Resume is only supported for live triggering");
    const previous = (await readFile(opts.resume, "utf8")).trim().split("\n").map(JSON.parse);
    for (const row of previous.filter((candidate) => candidate.id && candidate.run)) {
      const current = selected.find((c) => c.id === row.id);
      if (
        !current ||
        current.prompt !== row.prompt ||
        current.expected !== row.expected ||
        (row.skillsRef ?? "working-tree") !== (opts["skills-ref"] ?? "working-tree") ||
        row.run.provider !== (opts.provider ?? "claude") ||
        row.run.model !== (opts.model ?? ((opts.provider ?? "claude") === "claude" ? "claude-haiku-5-5" : "gpt-6-luna"))
      )
        throw new Error("Resume cases/provider/model do not match");
      if (["completed", "skill", "maxTurns"].includes(row.run.status) && !rows.some((r) => r.id === row.id)) {
        rows.push(row);
        budget.spent += row.run.costEstimateUsd;
        await output.record(row);
      }
    }
  }
  if (opts.static) {
    // Only descriptions, never core blocks or skill bodies, enter the classifier prompt.
    const { value, run } = await judge({
      cwd: root,
      rubric:
        'Predict the FIRST relevant skill for each prompt using only descriptions. Return {"predictions":[{"id":"case id","skill":"skill name or null"}]}. No task execution. Prefer the explicit task over incidental vocabulary.',
      input: { skills: inventory, cases: selected.map(({ id, prompt }) => ({ id, prompt })) },
      maxUsd: 0.75,
    });
    if (
      !Array.isArray(value.predictions) ||
      value.predictions.length !== selected.length ||
      new Set(value.predictions.map((p) => p.id)).size !== selected.length
    )
      throw new Error("Invalid prediction coverage");
    for (const c of selected) {
      const p = value.predictions.find((prediction) => prediction.id === c.id);
      if (!p || (p.skill !== null && !names.includes(p.skill))) throw new Error("Invalid predicted skill");
      const row = {
        ...c,
        skillsRef: opts["skills-ref"] ?? "working-tree",
        skillsRevision: revision,
        predicted: p.skill,
      };
      rows.push(row);
      await output.record(row);
    }
    await output.record({ judgeRun: run });
  } else {
    for (const c of selected.filter((candidate) => !rows.some((row) => row.id === candidate.id))) {
      const workspace = await fixture(opts.fixture, opts["skills-ref"]);
      try {
        const run = await runAgent({
          provider: opts.provider ?? "claude",
          model: opts.model,
          cwd: workspace.cwd,
          prompt: c.prompt,
          maxTurns: Number(opts.turns ?? 4),
          stopOnSkill: c.mode !== "always-on",
          maxUsd: Number(opts["case-usd"] ?? 0.05),
          timeoutMs: 90000,
        });
        const predicted = run.skillLoads[0]?.skill?.split(":").at(-1) ?? null;
        let turns = 0;
        const firstTwo = run.events.filter((e) => {
          if (
            e.type === "assistant" ||
            (run.provider === "codex" &&
              e.type === "item.completed" &&
              ["agent_message", "command_execution", "mcp_tool_call"].includes(e.item?.type))
          )
            turns++;
          return turns <= 2;
        });
        const predicted2 = normalize(firstTwo).skillLoads[0]?.skill?.split(":").at(-1) ?? null;
        const text = answer(run);
        const behavior =
          c.expected === "communication"
            ? {
                pass: !!text && text.length < 6000 && !/—|In conclusion|I'd be happy/.test(text),
                rubric: "nonempty, bounded, plain voice (proxy only)",
              }
            : {
                pass:
                  /budget|bounded|BUDGET/i.test(text + JSON.stringify(run.toolCalls)) &&
                  !run.toolCalls.some((t) => /sleep/i.test(t.name)),
                rubric: "bounded plan and no sleep (proxy only)",
              };
        const row = {
          ...c,
          skillsRef: opts["skills-ref"] ?? "working-tree",
          skillsRevision: revision,
          predicted,
          predicted2,
          behavior: c.mode === "always-on" ? behavior : undefined,
          run,
        };
        await output.record(row);
        if (!["completed", "skill", "maxTurns"].includes(run.status))
          throw new Error(`Case ${c.id}: ${run.status}: ${run.stderr.slice(-500)}`);
        rows.push(row);
      } finally {
        await workspace.cleanup();
      }
    }
  }
} catch (error) {
  failure = error.message;
  await output.record({ error: failure, run: error.run });
}
const loadRows = rows.filter((r) => r.mode !== "always-on");
const report = metrics(loadRows, names);
const positives = loadRows.filter((r) => r.expected !== null);
await output.record({
  comparison: {
    skillsRef: opts["skills-ref"] ?? "working-tree",
    skillsRevision: revision,
    recall2: opts.static ? null : positives.filter((r) => r.predicted2 === r.expected).length / positives.length,
    recall4: positives.filter((r) => r.predicted === r.expected).length / positives.length,
    alwaysOn: rows.filter((r) => r.mode === "always-on").map((r) => ({ id: r.id, behavior: r.behavior })),
    cost: budget.spent,
  },
});
const correct = rows.filter((r) =>
  !opts.static && r.mode === "always-on" ? r.behavior?.pass : r.expected === r.predicted,
).length;
const behaviorRows = rows.filter((r) => r.mode === "always-on");
const recallText = opts.static
  ? ""
  : `\nLoad recall, first 2 steps: ${positives.filter((r) => r.predicted2 === r.expected).length}/${positives.length}; up to ${opts.turns ?? 4}: ${positives.filter((r) => r.predicted === r.expected).length}/${positives.length}. Always-on behavior proxies: ${behaviorRows.filter((r) => r.behavior?.pass).length}/${behaviorRows.length}.\n`;
const summary =
  `# Triggering (${opts.static ? "static" : "live"})\n\n${rows.length}/${selected.length} completed; ${correct} correct (always-on live cases use behavior proxies).${recallText} Estimated cost: $${budget.spent.toFixed(4)}.${failure ? `\nINCOMPLETE: ${failure}` : ""}\n\n| Skill | Precision | Recall | TP | FP | FN |\n|---|---:|---:|---:|---:|---:|\n` +
  report.perSkill
    .filter((s) => !["communication", "economy"].includes(s.skill))
    .map(
      (s) =>
        `| ${s.skill} | ${s.precision?.toFixed(2) ?? "n/a"} | ${s.recall?.toFixed(2) ?? "n/a"} | ${s.tp} | ${s.fp} | ${s.fn} |`,
    )
    .join("\n") +
  "\n\nConfusions: " +
  JSON.stringify(report.confusion);
await output.summary(summary);
console.log(summary);
process.exitCode = failure
  ? 2
  : rows.some((r) => (r.mode === "always-on" && !opts.static ? !r.behavior?.pass : r.expected !== r.predicted))
    ? 1
    : 0;
