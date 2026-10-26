# Replay real KeepCart slices under a $25 ceiling

Five landed slices, their parent checkouts, two repetitions, four skill conditions on
`gpt-6.1-sol` at medium effort, and full/none on `gpt-6-luna` at medium: 60 cells.
The manifests narrow the large archive commit to its independently testable wire codec.
References supply context and hidden acceptance tests, never an exact-patch oracle.
The shell refactor uses existing behavior tests and a public-import check.

```powershell
$env:EVALS_MAX_USD = '25'
node evals/replay/run.mjs --mode preflight --id keepcart-v1 --skills-ref origin/steering/economy
node evals/replay/probe.mjs
node evals/replay/run.mjs --id keepcart-v1 --skills-ref origin/steering/economy --priority contrasts
node evals/replay/verify.mjs evals/results/replay/keepcart-v1
node evals/replay/codec-mutation.mjs evals/results/replay/keepcart-v1
node evals/replay/regrade.mjs evals/results/replay/keepcart-v1
node evals/replay/report.mjs evals/results/replay/keepcart-v1
node --test evals/replay/*.test.mjs
```

Override `--repository`/`KEEPCART_REPOSITORY` and `--donor`/`KEEPCART_DEPENDENCIES`
for another machine. Trials are temporary detached worktrees. Only third-party dependencies
link to the installed donor; `@keepcart/*` workspace imports resolve to each trial.
No command installs in, changes, commits, or pushes the source or donor checkout.
Cleanup unlinks junctions before removing its checked absolute trial directory.

`--tasks`, `--conditions`, `--models`, `--seeds` select bounded subsets.
The same `--id` resumes completed cells using a shared spend ledger; never run two writers
with the same ID. Costs include judge calls and unmetered-failure reservations.
`--priority contrasts` runs full/none cells before the remaining single-skill ablations.
Codex pricing is the existing runner's configurable estimate, not an invoice; terminal-only
usage cannot enforce an instantaneous dollar stop. Reservations prevent starting an
unaffordable next trial, and every reported overrun must remain visible.

Results and raw transcripts stay in gitignored `evals/results/replay/<id>/`.
Preflight records parent-red/reference-green results. Do not label import/fixture errors
as distinguishing regressions. An incomplete cell is a failed attempt, never a pass.

## Measurements preserve uncertainty

- Hidden tests are overlaid only after capturing agent tests and completing mutation.
  Diffs are always measured from the pinned parent, including changes committed inside a trial.
  The uninstall acceptance also preserves WriteRevision's existing, distinct uninstall behavior.
- `verify.mjs` serializes one retry of outer process deadlines after agent work stops; original
  outcomes remain attached. It also runs that preservation suite for every uninstall trial.
- AST mutations cover changed production lines, stratified by file and operator/boundary/return;
  `--mutants` defaults to nine per trial. Report available, sampled, invalid and timed-out counts.
  Failures inside selected tests kill; import/type/setup crashes do not. Baseline must be green and nonempty.
- A Stryker dry-run probe records compatibility with KeepCart's installed runtime before use.
  If unavailable, report the exact failure and use the bounded AST runner.
- KeepCart's scoped lint is authoritative for its workspace and import-layer conventions.
  New domain infrastructure imports, production-derived expected values and mocked imported
  subjects are cited review signals; none alone establishes a semantic violation.
- Export/used-once counts are source signals, not a reward for fewer types. Compare reference
  diff size as context; implementation alternatives can pass.
- PBT signals detect fast-check calls. Custom generated-law tests require transcript/judge review.
  A UI test in happy-dom is not browser evidence. Unavailable browser evidence stays unavailable.
- The cheap judge receives the brief, line-numbered agent code and reference diff. Every 0-3
  criterion needs a valid exact file/line quote; malformed or unsupported judgments stay missing.
  Its mutation input contains counts and sites, rather than repeated test-failure logs.

Full exposure copies the pinned revision's skill files and always-on cores. Ablations expose
only the named skill and its own references; build's link to testing is intentionally absent.
None removes restored harness skills. All conditions share concise repo conventions and commands,
not KeepCart's embedded harness prose. Prompts forbid history inspection and other checkouts;
this is instruction-level isolation, not an adversarial security sandbox.

## Delta verification

`node scripts/verify-changed.mjs --cwd <consumer> --base <ref> [--tests a.test.ts,b.test.ts] [--codec codec.ts]`
checks type-aware scoped lint over changed sources and their reverse local-import consumers,
then green nonempty suites in changed/direct-consumer folders against bounded changed-line mutations. It reports kills,
survivors, invalids and timeouts separately and exits nonzero unless every sampled mutant dies.
Unresolved aliases require explicit preservation suites with `--tests`; local imports and reexports
are followed transitively for lint; `--tests` also adds preservation suites outside those folders. Union/tagged-result declaration edits enable `--type-aware --type-check`. Runtime browser/cache/report output is excluded before lint arguments.
No universal mutation score is inferred from this small sample.

The replay condition `delta` exposes the revised full skill bundle and this verification tool.
Select it explicitly with `--conditions delta`; the default matrix remains unchanged.

Replay a saved surviving mutant without changing the baseline file:
`node evals/replay/reproduce.mjs <saved-row.json> <new-result.json>`.
It selects existing consumer suites before overlaying any hidden tests, requires a green
baseline, reuses the original mutation sites and restores production after each mutant.
