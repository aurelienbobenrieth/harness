import { load, save, out } from "./common.mjs";
import { writeFileSync } from "node:fs";
import path from "node:path";
const findings = load("findings"),
  catalog = load("catalog"),
  { samples, grades } = load("precision"),
  seeds = load("recall"),
  ledger = load("ledger");
if (grades.length !== samples.length || new Set(grades.map((g) => g.key)).size !== samples.length)
  throw Error("Incomplete precision evidence");
const rows = catalog.map((e) => {
  const measured = findings.filter((r) => r.id === e.id),
    judged = grades.filter((g) => samples.find((s) => s.key === g.key)?.id === e.id);
  const tp = judged.filter((g) => g.grade === "true-positive").length,
    fp = judged.filter((g) => g.grade === "false-positive").length,
    debatable = judged.filter((g) => g.grade === "debatable").length;
  const cases = seeds.filter((s) => s.id === e.id),
    valid = cases.filter((s) => !s.error),
    hits = Object.fromEntries(
      measured.map((r) => [r.repo, r.error ? null : r.findings.filter((f) => !f.evaluation).length]),
    );
  return {
    ...e,
    hits,
    totalHits: Object.values(hits).reduce((a, b) => a + (b ?? 0), 0),
    precision: tp + fp ? tp / (tp + fp) : null,
    tp,
    fp,
    debatable,
    recall: valid.length ? valid.filter((s) => s.hit).length / valid.length : null,
    seedHits: valid.filter((s) => s.hit).length,
    seedAttempts: cases.length,
    seedErrors: cases.filter((s) => s.error).length,
    ms: measured.reduce((n, r) => n + r.ms, 0),
    errors: measured.filter((r) => r.error || r.crashes?.length).length,
    unsupported: measured.filter((r) => r.findings.some((f) => f.evaluation)).length,
    timeScope: measured[0]?.timeScope ?? "per-rule wall time",
  };
});
save("summary", { rows, totalUsd: ledger.reduce((n, r) => n + r.usd, 0) });
const rank = (r) => (r.precision ?? 0.5) + (r.recall ?? 0.5) - (r.errors ? 1 : 0);
const deterministic = rows.filter((r) => r.kind !== "agentlint"),
  sorted = deterministic.toSorted((a, b) => rank(a) - rank(b) || b.totalHits - a.totalHits || a.id.localeCompare(b.id));
const worst = sorted.slice(0, 15),
  best = sorted.slice(-5).toReversed();
const pct = (n) => (n === null ? "n/a" : Math.round(n * 100) + "%");
const table = [
  "|Rule|Hits K/B/P/S|Precision TP/FP/?|Recall fired/valid; errors|Time s*|",
  "|---|---|---|---|---|",
  ...[...worst, ...best].map(
    (r) =>
      `|${r.id}|${["keepcart", "kitbois", "panache", "studio"].map((k) => (r.hits[k] === null ? "?" : (r.hits[k] ?? 0))).join("/")}|${pct(r.precision)} ${r.tp}/${r.fp}/${r.debatable}|${pct(r.recall)} ${r.seedHits}/${r.seedAttempts - r.seedErrors}; ${r.seedErrors}|${(r.ms / 1000).toFixed(2)}|`,
  ),
];
const agent = rows.filter((r) => r.kind === "agentlint");
const dead = deterministic.filter((r) => r.totalHits === 0 && r.errors === 0 && r.unsupported === 0).map((r) => r.id);
const unavailable = deterministic.filter((r) => r.totalHits === 0 && (r.errors || r.unsupported)).map((r) => r.id);
const candidates = load("candidates").candidates;
const timings = load("timings");
const slow = findings
  .filter((r) => !r.timeScope && r.kind !== "oxlint" && r.kind !== "agentlint")
  .toSorted((a, b) => b.ms - a.ms)
  .slice(0, 5);
const text = [
  "# Deterministic steering: real consumer evaluation",
  "Worst 15 then best 5; K/B/P/S = keepcart/kitbois/panache/studio. TP/FP/? = true/false/debatable.",
  ...table,
  "* Oxlint times are shared package wall time summed across repos, not individual rule cost. Agentlint state times are also shared; other times are per rule.",
  "Combined lint wall seconds K/B/P/S: " +
    timings.map((r) => (r.ms / 1000).toFixed(2)).join("/") +
    "; JS per-rule timings unavailable from --debug=timings.",
  "Slowest individually timed checks: " +
    slow.map((r) => r.repo + " " + r.id + " " + (r.ms / 1000).toFixed(2) + "s").join("; ") +
    ".",
  "Scope stress: every exported rule runs globally; out-of-domain findings require consumer overrides, not automatic detector changes.",
  "Recall errors (invalid seeds or missing prerequisites) are excluded from valid denominators; n/a is unmeasured, never a pass.",
  "Zero-hit/unobserved rules: " + dead.join(", ") + ".",
  "Unavailable zero-hit checks: " + unavailable.join(", ") + ".",
  "Noisy (>=100 in one repo): " +
    deterministic
      .filter((r) => Object.values(r.hits).some((n) => n >= 100))
      .map((r) => r.id)
      .join(", ") +
    ".",
  "Fixes: " + (process.env.EVALS_FIXES ?? "No production changes justified yet; see PR for final fix status."),
  `Agentlint report only: ${agent.length} rules; ${agent.reduce((n, r) => n + r.totalHits, 0)} hits; ${agent.reduce((n, r) => n + r.errors, 0)} rule/repo errors. State = tracked HEAD clone (300s limit); change = latest commit. Errors are unavailable coverage. No agentlint files edited.`,
  "Agentlint nonzero: " +
    agent
      .filter((r) => r.totalHits)
      .map((r) => `${r.id} ${r.totalHits} (P ${pct(r.precision)})`)
      .join("; ") +
    ".",
  "Agentlint observed zero-hit (excludes errors): " +
    agent
      .filter((r) => !r.totalHits && !r.errors)
      .map((r) => r.id)
      .join(", ") +
    ".",
  "Candidate new rules (proposals only):",
  ...candidates.map((c, i) => `${i + 1}. ${c.name}: ${c.example.replace(/\n/g, " ")} [${c.sources[0]}]`),
  `Total estimated eval spend: $${ledger.reduce((n, r) => n + r.usd, 0).toFixed(4)} / $10; includes failed judge attempts.`,
  "Scope: 2 deterministic precision samples per rule/repo; two seeded variants per oxlint/conformance rule; syntax-only oxlint-config; formatter check only.",
  "Raw consumer excerpts and review comments remain local, gitignored. Full per-rule JSON: " +
    path.join(out, "summary.json"),
];
writeFileSync(path.join(out, "report.md"), text.join("\n") + "\n");
if (process.env.EVALS_REPORT_PATH) writeFileSync(process.env.EVALS_REPORT_PATH, text.join("\n") + "\n");
console.log(text.join("\n"));

const publicRows = rows.map(
  ({
    id,
    pkg,
    kind,
    hits,
    totalHits,
    precision,
    tp,
    fp,
    debatable,
    recall,
    seedHits,
    seedAttempts,
    seedErrors,
    ms,
    errors,
    unsupported,
    timeScope,
  }) => ({
    id,
    pkg,
    kind,
    hits,
    totalHits,
    precision,
    tp,
    fp,
    debatable,
    recall,
    seedHits,
    seedAttempts,
    seedErrors,
    ms,
    errors,
    unsupported,
    timeScope,
  }),
);
writeFileSync(
  path.resolve(import.meta.dirname, "baseline.json"),
  JSON.stringify(
    {
      date: "2026-10-25",
      consumerRevisions: Object.fromEntries(
        ["keepcart", "kitbois", "panache", "studio"].map((repo) => [repo, load("inventory-" + repo).commit]),
      ),
      totalEstimatedUsd: ledger.reduce((n, r) => n + r.usd, 0),
      rows: publicRows,
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(
  path.resolve(import.meta.dirname, "fixtures.json"),
  JSON.stringify(
    seeds.map(({ id, repo, index, seed }) =>
      seed
        ? { id, repo, index, seed: { file: seed.file, source: seed.source, files: seed.files, options: seed.options } }
        : { id, index, error: "Seed generation unavailable", hit: false },
    ),
    null,
    2,
  ) + "\n",
);
