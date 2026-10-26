# Measure deterministic rules on read-only consumer trees

Run `pnpm install --frozen-lockfile && pnpm build`, then `pnpm evals:deterministic`. The pipeline replays committed generated fixtures when available; individual stages are:

```powershell
$env:EVALS_MAX_USD = '10'
node evals/deterministic/collect.mjs
node evals/deterministic/timing.mjs
node evals/deterministic/mining.mjs
node evals/deterministic/replay.mjs # or recall.mjs to generate fixtures
node evals/deterministic/precision.mjs
node evals/deterministic/report.mjs
```

`common.mjs` declares local consumer paths. Keepcart uses a detached worktree at
`origin/v2/build`; create it before collecting. Other consumers retain their checked-out
revisions. No consumer installs, configuration writes, fixes, or commits occur.
Raw results and consumer excerpts stay in gitignored `evals/results/deterministic/`. `baseline.json` contains aggregate metrics and pinned revisions; `fixtures.json` contains generated Harness examples without consumer bodies.
Run all judge stages sequentially: one shared ledger resumes completed calls and
charges failures. The reused `evals/lib/runner.mjs` judge defaults to Codex `gpt-6-luna`.
Set the cap once for the entire campaign, not independently for each stage.
Rates are planning estimates, not invoices; one in-flight response can exceed its reservation.

Collection enables every exported oxlint rule with its default options. Domain rules
run even on consumers without that domain. Conformance checks retain explicit missing
evidence separately from violations. Opt-in instruction-block and CSS checks need project
contracts and remain unconfigured. Compiler strictness is enabled explicitly. Cloudflare's
clock is fixed to 2026-10-25. Agentlint state rules share one engine pass in a disposable clone of HEAD (5-minute bound); change rules use
`HEAD^..HEAD`, so their scope is one commit, not historical recall. Agentlint is measured only.
Oxlint-config is measured without type-aware checking because the detached consumer has no
install; this limits conclusions about its type-based rules. Oxfmt runs with `--check`.

Precision samples the first and middle finding per rule/repo, at most two. The judge sees
the rule's description and an excerpt. Precision is TP/(TP+FP); debatable grades are excluded
and reported separately. Sampling is deterministic and estimates are not confidence claims.

Recall uses two judge-varied documented fixtures per oxlint/conformance rule, seed 25102026.
Each oxlint snippet is appended to a real source copy, comparing diagnostics before/after (barrel-only probes replace the copied body);
conformance seeds overlay copies of matching consumer configs. Missing prerequisites and
invalid generated syntax are errors, not successes. A seed is a small probe of activation,
not a claim about all realistic variants. The prompt seed labels variants; it is not an API RNG seed. Committed generated fixtures make subsequent replay deterministic. Inspect misses before changing rules.

Oxlint reports package wall time shared by its rules; do not add these rule times together.
Conformance and agentlint change timings are per rule; agentlint state timing is shared. A zero count with a crash or missing
evidence is unavailable coverage. Other zero counts are unobserved on this corpus, not proof
that the rule is dead. Noisy means at least 100 findings in any consumer. `timing.mjs` runs one combined pass with oxlint `--debug=timings`; this installed release emitted no JS per-rule timing table, so package/shared wall times remain explicit.

`node --test evals/deterministic/common.test.mjs` checks seed path containment, invalid lint
configuration handling, escaped fixture normalization, and budget reservations without model calls.

Statement padding (including the deprecated padding-before-exit rule) is formatting, excluded from reported lint findings. Run `harness-format-padding` after oxfmt instead. Function runtime checks require a declaring extension manifest; seeded cases include it.
