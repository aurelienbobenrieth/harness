# Generated code shape and scripted skills

Compare actual generated diffs under no Harness, PR #82 prose skills, and the same
skills with three deterministic helpers. This is a small synthetic study, not a
claim about every repository or a statistically powered benchmark.

```powershell
pnpm install --frozen-lockfile
pnpm build
$env:EVALS_MAX_USD='15'
node evals/code-shape/run.mjs --prose 9bd621e --scripted 1402a66 --seeds 2 --concurrency 8
```

The candidate commit remains reachable in branch history even when losing scripts
are removed. `--resume <jsonl>` carries completed rows and their costs forward;
`--prior-usd <amount>` carries probes and any spend outside those rows. Never resume
concurrently with the original process. `--limit <total-rows>` supports a paid smoke
run without changing task contracts. No Opus model is used.

The complete matrix has 112 agent runs: 48 shape runs (four tasks, three conditions,
two models, two repetitions) and 64 existing behavior runs (eight tasks, two
conditions, two models, two repetitions). The prose shape rows serve both comparisons.
Conditions reverse order on the second repetition. Each agent receives a fresh
fixture; all paid calls, including blind judges, share the existing CostGuard.
Budget/turn/time censoring is a failure and is reported separately from completed
work. Calls can finish one in-flight response after a dollar boundary, as documented
for the shared runner. Prices are conservative estimates, not invoices.
The recorded experiment resumed the behavior phase at concurrency 2 after a
provider 429 at concurrency 8; the failed shape run remains a failure, with its cost.
Token means exclude unavailable usage rather than treating it as zero.

The fixture has eleven source modules and three test files. Node runs real
TypeScript/Effect 4 code using the Effect installation pinned by the repository
lockfile. No fixture dependency install or network call is needed. The four tasks
exercise an existing boundary, duplicate pricing, selective bounded carrier retries,
and a remaining-price bug. Independent literal acceptance tests are installed after
the agent exits. Tests, check script and package metadata are checked separately.

Deterministic metrics use the repository's strict oxlint config plus every core and
Effect plugin rule (type-aware mode disabled because this fixture has no tsgo
project), jscpd duplication (25 tokens/3 lines), jscpd cyclomatic totals/maxima,
knip exports/types, actual test outcomes, and inserted/deleted source/test lines.
Counts are for the whole fixture, so compare conditions rather than interpreting
baseline style findings as new defects. New files are included in the diff.

The blind judge scores temporal coupling, abstraction, boundaries, naming, and
testing from 0 to 3. Each score requires a real final-file line and a reason. Invalid
or unavailable judgments stay missing, never zero. `measurements.json` aggregates
conditions; `evidence.json` retains diffs, final sources, cited scores, usage and
observed helper calls. Raw CLI transcripts stay in gitignored `evals/results/`.
Claude terminal aggregate usage replaces provisional stream counters. Recompute
saved measurements without paid calls with `node evals/code-shape/regrade.mjs
<raw-jsonl> <prior-usd>`; retain the original JSONL as the audit source.
Codex patch items count as tool calls, deduplicated across start/completion events.
Unmetered provider failures consume their full case reservation, including when
regrading older transcripts that recorded them as free work. Per-call context
records stay separate from cumulative terminal totals for incident detectors.

Keep a helper only with observed usage, no paired-task pass-rate loss, and fewer
tokens or calls. The helpers are evaluated as one candidate bundle; do not attribute
a bundle gain to an individual helper without its task-specific evidence. No
independent design-rule wording change is proposed by this experiment.

```powershell
node --test evals/lib/code-shape.test.mjs
```

All three helpers were rejected and removed from the final tree. Their candidate
tests at commit `1402a66` run with `node --test skills/build/scripts/*.test.mjs
skills/testing/scripts/*.test.mjs skills/git/scripts/*.test.mjs`.
