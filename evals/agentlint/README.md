# Calibrate all 60 agentlint rules before changing the gates

[The review](review.md) gives the proposed 60 → 37 judgment gates. [verdicts.json](verdicts.json) records each rule's purpose in agent-written code, deterministic overlap, verdict and consolidation target. [results.json](results.json) contains per-consumer counts, errors and judged precision without consumer excerpts.

Run from an isolated Harness worktree after `pnpm install --frozen-lockfile` and building the six agentlint plugins:

```powershell
$env:EVALS_MAX_USD = '10'
node evals/agentlint/run.mjs baseline
node evals/agentlint/run.mjs judge baseline
# Apply and build plugin changes, keeping the consumers at the same commits.
node evals/agentlint/run.mjs after
node evals/agentlint/run.mjs judge after
node evals/agentlint/run.mjs backlog local/pr88/agentlint-review.json
node evals/agentlint/run.mjs report
```

`AGENTLINT_KEEPCART`, `AGENTLINT_KITBOIS`, `AGENTLINT_PANACHE` and `AGENTLINT_STUDIO` select read-only source repositories. KeepCart must be a detached worktree at `origin/v2/build`; the defaults name the review's Windows paths. `AGENTLINT_ONLY` selects one consumer; `AGENTLINT_RULE` selects a diagnostic rule. `AGENTLINT_ENGINE` can select a different engine executable; the recorded engine path identifies which one ran. `AGENTLINT_PLUGIN_ROOT` can select a frozen copy of built plugins. Do not mix engine versions between a before/after comparison.

Each scan clones tracked HEAD into an OS temporary directory, injects a config enabling every exported rule, and deletes only that clone in `finally`. No consumer config, acceptance or source file is written. State rules inspect tracked source; change rules inspect `HEAD^..HEAD`, including manifests. This is a broad activation stress test, not the consumer's configured gate. Repository-configured rules with empty options remain unmeasured, not validated.

The identical evaluation scope excludes `.agents/**`, minified JavaScript, build output, dependencies and generated route trees in both phases. A parse failure triggers one bounded retry excluding the exact rejected files; those files and the first failure remain recorded as unavailable coverage. Other failures and 300-second timeouts remain errors. Surviving findings after recovery never certify the omitted files. The historical unfiltered scan is a separate comparison. Panache defaults to batches of 100 tracked files; `AGENTLINT_CHUNK_SIZE=1..200` opts other consumers in. Batching refuses repository-wide state detectors, runs all file-local detectors over every selected file, and evaluates change rules once on the full original Git diff through the engine testing API.

Judging uses `evals/lib/runner.mjs`, its tool-free cheap judge and a persistent local cost ledger. At most eight stable, repository-balanced samples per rule and phase are graded `tp`, `fp` or `uncertain`. Precision is `tp/(tp+fp)`; uncertainty and sample counts stay visible. A review trigger is not automatically a defect. Hash-keyed results are reused across unchanged phases; malformed/interrupted responses are errors, never favorable labels. Every invocation reloads the same spend ledger, capped at $10; interrupted/unmetered attempts use the runner's reserved estimate. No Opus model is selected.

`local/` is ignored because it contains private consumer source, full CI review artifacts and model transcripts. Commit only aggregate counts, sanitized reasons, anonymized regression fixtures and the report. Do not treat precision on up to eight samples as a population guarantee or infer recall from zero hits.

The backlog projection replays changed rules against the sources in an actual CI artifact and counts retained decisions under the proposed set. It separately exposes rule-version acceptance invalidation, omitted parser coverage and local consumer rules. Removing a source acceptance obligation does not mean a deterministic replacement passes. Merges are recommendations for the owner, not implementations hidden in this PR.
