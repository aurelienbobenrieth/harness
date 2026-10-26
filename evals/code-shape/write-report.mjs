import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "../lib/io.mjs";
import { retention } from "./retention.mjs";

const number = (value, digits = 1) => (value === null || value === undefined ? "n/a" : value.toFixed(digits));
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const totalTokens = (row) => Object.values(row.tokens).reduce((a, b) => a + b, 0);
const scores = (condition) =>
  Object.values(condition.scores)
    .map((value) => number(value, 2))
    .join("/");
const score = (condition) => mean(Object.values(condition.scores).filter((value) => value !== null));

export async function writeReport(destination, raw) {
  if (!destination || !raw) throw Error("Usage: node write-report.mjs <report.md> <raw-jsonl>");
  const summary = JSON.parse(await readFile(path.join(root, "evals/results/code-shape/measurements.json"), "utf8"));
  const evidence = JSON.parse(await readFile(path.join(root, "evals/results/code-shape/evidence.json"), "utf8"));
  const shapes = summary.conditions.filter(
    (condition) => condition.condition.startsWith("shape/") && !condition.condition.endsWith("/scripted"),
  );
  const comparison = ["claude", "codex"].map((model) => {
    const prose = shapes.find((row) => row.condition === `shape/${model}/prose`);
    const none = shapes.find((row) => row.condition === `shape/${model}/none`);

    return {
      model,
      delta: prose && none ? score(prose) - score(none) : null,
      passDelta: prose && none ? prose.passRate - none.passRate : null,
    };
  });
  const improves = comparison.every((row) => row.delta > 0 && row.passDelta >= 0);
  const bundle = [];

  for (const provider of ["claude", "codex"])
    for (const condition of ["prose", "scripted"]) {
      const rows = evidence.filter((row) => row.provider === provider && row.condition === condition);

      bundle.push({
        provider,
        condition,
        n: rows.length,
        pass: rows.filter((row) => row.pass).length,
        calls: mean(rows.map((row) => row.calls)),
        seconds: mean(rows.map((row) => row.durationMs / 1000)),
        tokens: mean(rows.filter((row) => row.metered !== false).map(totalTokens)),
        cache: mean(
          rows
            .filter((row) => row.metered !== false)
            .map((row) => row.tokens.cached + row.tokens.cacheWrite5m + row.tokens.cacheWrite1h),
        ),
        usd: rows.reduce((sum, row) => sum + row.usd, 0),
        helperRuns: rows.filter((row) => row.helperCalls.length).length,
      });
    }

  const helperUsage = Object.fromEntries(
    ["draft", "affected", "check"].map((name) => [
      name,
      evidence.filter(
        (row) =>
          row.condition === "scripted" &&
          row.helperCalls.some((call) =>
            new RegExp(`scripts[\\\\/]+${name}\\.mjs`, "u").test(JSON.stringify(call.arguments)),
          ),
      ).length,
    ]),
  );
  const decisions = retention(evidence);

  await writeFile(
    path.join(root, "evals/results/code-shape/retention.json"),
    JSON.stringify(decisions, null, 2) + "\n",
  );

  const lines = [
    `# Harness code shape and scripted skills`,
    summary.completed < summary.expected
      ? "INCOMPLETE: no final conclusion until the planned matrix finishes."
      : improves
        ? "Skills improved the measured code-shape score on both models without lowering functional pass rate in this fixture."
        : "The skills did not demonstrate a consistent code-shape improvement across both models in this fixture.",
    `Two repetitions of four TypeScript/Effect tasks per model (claude=Haiku 5.5, codex=gpt-6-luna); prose=9bd621e, scripted=1402a66. ${summary.completed}/${summary.expected} planned agent runs recorded. Small synthetic sample; no statistical significance claim.`,
    "",
    "| Model / skills | n / functional pass | lint (Harness) | duplicated lines | CC total / max | dead exports | tests added / green runs | diff + / - |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...shapes.map(
      (row) =>
        `| ${row.condition.replace("shape/", "")} | ${row.runs} / ${row.passed} | ${number(row.metrics.findings)} (${number(row.metrics.harnessFindings)}) | ${number(row.metrics.duplicatedLines)} | ${number(row.metrics.cyclomaticTotal)} / ${number(row.metrics.cyclomaticMax)} | ${number(row.metrics.deadExports)} | ${row.testsAddedRuns} / ${row.testsGreenRuns} | ${number(row.metrics.added)} / ${number(row.metrics.deleted)} |`,
    ),
    "",
    "| Model / skills | judge T/A/B/N/test (0-3) | judged | mean tokens (cache included) | mean calls | total $ |",
    "| --- | --- | --- | --- | --- | --- |",
    ...shapes.map(
      (row) =>
        `| ${row.condition.replace("shape/", "")} | ${scores(row)} | ${row.judged}/${row.runs} | ${number(row.tokens, 0)} (${number(row.cacheTokens, 0)}) | ${number(row.calls)} | ${number(row.usd, 4)} |`,
    ),
    "",
    "T=temporal coupling, A=abstraction earns keep, B=boundaries, N=naming. Whole-fixture deterministic counts and diff sizes are means; test count is not a quality target. Functional pass requires added coverage, green tests and independent acceptance checks. Oxlint uses the strict base plus core/Effect rules, with type-aware mode off.",
    "",
    "| Model | condition | n / pass | mean seconds / calls | mean tokens (cache included) | total $ | helper-used runs |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...bundle.map(
      (row) =>
        `| ${row.provider} | ${row.condition} | ${row.n} / ${row.pass} | ${number(row.seconds)} / ${number(row.calls)} | ${number(row.tokens, 0)} (${number(row.cache, 0)}) | ${number(row.usd, 4)} | ${row.helperRuns} |`,
    ),
    "",
    `Scripts are compared as a bundle across the existing economy, quality/git tasks and the shape tasks. Observed helper usage: Git draft ${helperUsage.draft}, affected tests ${helperUsage.affected}, compact checks ${helperUsage.check} runs. Exposure without use cannot establish helper savings.`,
    "Elapsed times were measured under eight concurrent shape agents, then two behavior agents after the 429; they are not isolated speed benchmarks.",
    `Kept: the code-shape eval, measured evidence, and token/call/cost accounting fixes; ${
      decisions.some((decision) => decision.keep)
        ? "helpers " +
          decisions
            .filter((decision) => decision.keep)
            .map((decision) => decision.helper)
            .join(", ")
        : "no candidate helpers"
    }. Rejected helpers and their wiring are reverted; candidate code and node:test suites remain reproducible at 1402a66 in branch history.`,
    `Retention decision: ${decisions.map((decision) => `${decision.helper} ${decision.keep ? "KEEP" : "REVERT"}`).join(", ")}. No independent design-rule wording change was tested.`,
    `Total spend: $${number(summary.spent, 4)}, including $${number(summary.priorUsd, 4)} of probes/smoke and all judges; EVALS_MAX_USD=15. Claude reported costs; Codex uses runner estimates, not invoices. Agent token/call columns exclude judge overhead.`,
    `Incomplete runs count as failures (${evidence.filter((row) => row.status !== "completed").length} agent runs); missing/invalid judges remain missing. One shape run hit a provider 429. Token means use only metered runs (${evidence.filter((row) => row.metered !== false).length}/${evidence.length}); unknown usage is not zero, and unmetered failures consume their full reservation. Claude terminal usage and Codex patch-call counts are corrected locally.`,
    "Validation: PENDING final gate.",
    "[Measurements](evals-shape-artifacts/measurements.json), [diffs and cited-line evidence](evals-shape-artifacts/evidence.json), [local raw transcript](evals-shape-artifacts/raw.jsonl).",
  ];

  if (lines.length > 50) throw Error("Report exceeds 50 lines");
  const artifacts = path.join(path.dirname(destination), "evals-shape-artifacts");

  await mkdir(artifacts, { recursive: true });
  for (const name of ["measurements", "evidence"])
    await copyFile(path.join(root, `evals/results/code-shape/${name}.json`), path.join(artifacts, `${name}.json`));
  await copyFile(raw, path.join(artifacts, "raw.jsonl"));
  await writeFile(destination, lines.join("\n") + "\n");
  console.log(JSON.stringify({ lines: lines.length, comparison, bundle, helperUsage }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await writeReport(process.argv[2], process.argv[3]);
