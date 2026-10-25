# Measure Harness steering

`pnpm evals:deterministic` measures oxlint, conformance, configs and agentlint on local
consumer repos. See [deterministic/README.md](deterministic/README.md) for scope, budget,
replay and coverage limits. `pnpm test:evals:deterministic` runs its local safety checks.

The Codex `gpt-6-luna` judge and cost guard in `lib/runner.mjs` are reused from the
`evals/skills` worktree (PR #84). Model calls remain local; CI has no judge credentials.
Consumer excerpts and archived review bodies remain under gitignored `results/`.
