import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { root } from "./run.mjs";

const folder = path.join(root, "evals/agentlint");
const read = (name) => JSON.parse(readFileSync(path.join(folder, "local", `${name}.json`), "utf8"));
const verdicts = JSON.parse(readFileSync(path.join(folder, "verdicts.json"), "utf8"));
const phases = [process.env.AGENTLINT_BEFORE_PHASE ?? "baseline", process.env.AGENTLINT_AFTER_PHASE ?? "after"];
const repositories = ["keepcart", "kitbois", "panache", "studio"];
const catalogs = phases.map((phase) => read(`${phase}-catalog`));
const runs = phases.map((phase) => Object.fromEntries(repositories.map((repo) => [repo, read(`${phase}-${repo}`)])));
const judgments = phases.map((phase) => read(`${phase}-judgments`));
const summarize = (entry) => {
  const values = entry?.samples?.map((sample) => sample.judgment?.label) ?? [];
  const count = (label) => values.filter((value) => value === label).length;
  const tp = count("tp"),
    fp = count("fp"),
    uncertain = count("uncertain");
  return { tp, fp, uncertain, samples: values.length, precision: tp + fp ? tp / (tp + fp) : null, error: entry?.error };
};
const rows = catalogs[0].map((entry) => {
  const decision = verdicts[entry.id];
  if (!decision) throw Error(`Missing verdict: ${entry.id}`);
  return {
    id: entry.id,
    package: entry.pkg,
    purpose: entry.standard.summary,
    agentRisk: decision.risk,
    lifecycle: entry.lifecycle,
    authority: entry.binding.authority,
    deterministicCoverage: decision.deterministic,
    verdict: decision.verdict,
    target: decision.target,
    why: decision.why,
    diagnosis:
      decision.diagnosis ??
      "Calibrate repository scope and inspect semantic exceptions; a trigger is not a proved defect.",
    judgedSamples: phases.map((phase, index) => ({
      phase,
      samples:
        judgments[index]
          .find((result) => result.id === entry.id)
          ?.samples?.map((sample) => ({ repository: sample.repo, ...sample.judgment })) ?? [],
    })),
    measurements: phases.map((phase, index) => ({
      phase,
      repositories: Object.fromEntries(
        repositories.map((repo) => {
          const run = runs[index][repo];
          return [
            repo,
            {
              commit: run.commit,
              hits:
                run.error || run.ruleErrors?.[entry.id] || ![0, 1].includes(run.exit)
                  ? null
                  : run.findings.filter((finding) => finding.rule.id === entry.id).length,
              error: Boolean(run.error || run.ruleErrors?.[entry.id] || ![0, 1].includes(run.exit)),
              unavailableFiles: entry.lifecycle === "state" ? (run.unavailableFiles?.length ?? 0) : 0,
              seconds: Math.round(run.ms / 1000),
            },
          ];
        }),
      ),
      precision: summarize(judgments[index].find((result) => result.id === entry.id)),
    })),
  };
});
if (rows.length !== 60 || Object.keys(verdicts).length !== 60) throw Error("Incomplete rule review");
const ledger = read("ledger");
const rawBacklog = read("backlog");
const backlog = {
  ...rawBacklog,
  fixes: rawBacklog.fixes.map((fix) => ({
    ...fix,
    errors: fix.errors.map((error, index) => ({
      file: `unparseable-${index + 1}${path.extname(error.file)}`,
      kind: "engine-grammar",
    })),
  })),
};
const counts = Object.values(verdicts).reduce(
  (result, value) => ({ ...result, [value.verdict]: (result[value.verdict] ?? 0) + 1 }),
  {},
);
const precision = (value) =>
  value.precision === null
    ? value.error
      ? "error"
      : `n/a${value.uncertain ? ` (?${value.uncertain})` : ""}`
    : `${Math.round(value.precision * 100)}% (${value.tp}/${value.tp + value.fp}${value.uncertain ? `;?${value.uncertain}` : ""})`;
const hits = (measurement) =>
  repositories
    .map((repo) => {
      const result = measurement.repositories[repo];
      return result.hits === null ? "error" : `${result.hits}${result.unavailableFiles ? "†" : ""}`;
    })
    .join("/");
const table = [
  "| rule | hits K/B/P/S before→after | precision before→after | verdict | why |",
  "|---|---|---|---|---|",
  ...rows.map(
    (row) =>
      `| ${row.id} | ${hits(row.measurements[0])}→${hits(row.measurements[1])} | ${precision(row.measurements[0].precision)}→${precision(row.measurements[1].precision)} | ${row.verdict}${row.target ? ` → ${row.target}` : ""} | ${row.why} |`,
  ),
].join("\n");
const spent = ledger.reduce((sum, entry) => sum + entry.usd, 0);
const remaining = backlog.proposed;
const body = [
  `Proposal: **60 → 37 judgment gates** (${counts.keep} kept, ${counts.fix} fixed, ${counts.merge} merged, ${counts.replace} replaced, ${counts.remove} removed). All 60 exports/presets survive; only two detector changes are implemented.`,
  "",
  table,
  "",
  `Backlog projection from PR #88: ${backlog.baseline.human} human + ${backlog.baseline.agent} agent = ${backlog.baseline.total} → ${remaining} obligations (${Math.round((1 - remaining / backlog.baseline.total) * 100)}% fewer); fixes alone: ${backlog.fixedOnly}. Counts include reopened surviving acceptances; replacements and unimplemented merge logic are excluded.`,
  "Owner decisions: bounded-work still has 0% sampled precision after its noise reduction; keep it advisory or retire it. Approve the 37-gate target and merge mappings; scope Shopify/Effect reviews to real domains; adopt deterministic replacements; decide the engine upgrade/parse gaps before enforcing. [Per-rule purposes, overlap and error counts](https://github.com/aurelienbobenrieth/harness/blob/agentlint/review/evals/agentlint/results.json).",
  "<details><summary>Methodology and limits</summary>",
  `Four tracked-HEAD clones; state=all source in identical evaluation scope, change=HEAD^..HEAD; engine 0.3.0; file-local detectors batched after global timeouts. †=partial parser coverage, error=unavailable, zero≠recall evidence. Tool-free cheap judge via evals/lib, up to 8 stable samples/rule/phase; precision=TP/(TP+FP), ?=uncertain. Spend $${spent.toFixed(4)}/$10. Historical 104 rule/repo errors were two failed full state scans; no plugin contract crash was demonstrated. [Backlog source: PR #88 CI artifact](https://github.com/KeepCart/app/actions/runs/40236718465). Checks: 2,933 unit tests passed; the full run passed 19/20 steps, then quality passed after fixing CLI entry-point reachability. See evals/agentlint/validation.json for details.`,
  "</details>",
].join("\n");
if (body.split("\n").length > 70) throw Error(`PR body is ${body.split("\n").length} lines`);
writeFileSync(path.join(folder, "review.md"), body + "\n");
const summary = {
  counts,
  activeProposal: 37,
  exportedRules: 60,
  engine: "0.3.0",
  spentUsd: spent,
  methodology: {
    sampleLimitPerRulePerPhase: 8,
    precision: "TP/(TP+FP); uncertain excluded and counted separately",
    scope: "tracked HEAD; .agents, minified, dependencies, generated route trees and build output excluded",
    partialCoverage: "Exact parser-rejected files excluded in one bounded recovery; errors remain visible",
    coverage: "A complete inventory of 60 rules is not a recall guarantee. Empty configurable bindings are unmeasured.",
    engineFindingIdentity:
      "An acceptance requires exact standard revision, detector version, binding digest, fingerprint and sufficient authority. Human can satisfy agent authority; proposals never open a gate. Lineage is context. The review app separates unresolved Queue and auditable Decisions.",
    historicalErrors:
      "104 = 52 state rules affected by one unavailable KeepCart and one timed-out Panache scan; not 104 independently identified plugin defects.",
  },
  backlog,
  rows,
};
writeFileSync(path.join(folder, "results.json"), JSON.stringify(summary, null, 2) + "\n");
if (process.env.AGENTLINT_REPORT_COPY) writeFileSync(path.resolve(process.env.AGENTLINT_REPORT_COPY), body + "\n");
console.log(JSON.stringify({ counts, spentUsd: spent, backlog: remaining, lines: body.split("\n").length }));
