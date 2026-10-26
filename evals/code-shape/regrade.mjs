import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "../lib/io.mjs";
import { normalize } from "../lib/transcript.mjs";
import { summarize } from "./report.mjs";

export async function regrade(input, priorUsd = 0) {
  if (!input) throw Error("Usage: node regrade.mjs <raw-jsonl> [prior-usd]");
  const rows = (await readFile(input, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);

  for (const row of rows) {
    Object.assign(row.run, normalize(row.run.events));

    // Older runners charged an unmetered provider failure $0. Reserve the entire
    // case allowance instead; an absent terminal usage event is not free work.
    for (const [run, allowance] of [
      [row.run, row.suite === "shape" ? 0.32 : 0.12],
      [row.judgment?.run, row.suite === "shape" ? 0.055 : 0.08],
    ]) {
      if (run && run.status !== "completed" && !run.usages.length && run.reportedCostUsd === null) {
        run.costEstimateUsd = run.maxUsd ?? allowance;
        run.costSource = "reserved-unmetered";
      }
    }

    row.usd = row.run.costEstimateUsd + (row.judgment?.run?.costEstimateUsd ?? row.judgment?.costEstimateUsd ?? 0);

    if (row.grade.measured) {
      const diagnostics = JSON.parse(row.grade.measured.raw.lint.stdout).diagnostics;

      row.grade.measured.harnessFindings = diagnostics.filter((finding) =>
        /^(core|effect)\(/u.test(finding.code ?? ""),
      ).length;
    }
  }

  const summary = summarize(rows);

  summary.completed = rows.length;
  summary.expected = 112;
  summary.priorUsd = Number(priorUsd);
  summary.spent = summary.priorUsd + rows.reduce((sum, row) => sum + row.usd, 0);
  summary.regradedFrom = path.basename(input);
  summary.models = [...new Set(rows.map((row) => row.run.model))];
  summary.revisions = Object.fromEntries(rows.map((row) => [row.condition, row.skillsRevision]));
  await mkdir(path.join(root, "evals/results/code-shape"), { recursive: true });

  await writeFile(
    path.join(root, "evals/results/code-shape/measurements.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );

  await writeFile(
    path.join(root, "evals/results/code-shape/evidence.json"),
    JSON.stringify(
      rows.map((row) => ({
        suite: row.suite,
        provider: row.provider,
        model: row.run.model,
        skillsRef: row.skillsRef,
        skillsRevision: row.skillsRevision,
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
        artifacts:
          row.suite === "shape"
            ? undefined
            : Object.fromEntries(
                Object.entries(row.artifacts).filter(([key]) =>
                  ["commit.txt", "pr.txt", "brief.txt", "decision.txt", "title.txt"].includes(key),
                ),
              ),
      })),
      null,
      2,
    ) + "\n",
  );

  console.log(JSON.stringify({ completed: rows.length, spent: summary.spent }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await regrade(process.argv[2], process.argv[3]);
