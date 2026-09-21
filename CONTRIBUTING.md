# Contributing

Start with a small reproduction and the user-visible behavior you want to improve. Open an issue for a new policy whose usefulness depends on project taste; a narrowly scoped bug fix can go straight to a pull request.

Use the Node ranges in the root manifest and the exact `packageManager` version. Install with `pnpm install --frozen-lockfile`. Run `pnpm check` before requesting review; run `pnpm test:package` when changing public exports, package metadata, dependency ranges, generated output, or consumer behavior. Also run `pnpm test:compatibility baseline` and `pnpm test:compatibility current` when changing dependency support. All three consumer checks are required for release preparation.

Every new rule includes its implementation, registration, positive and negative tests, README trigger, and changeset. Put it in the narrowest reusable package. An autofix needs one safe mechanical rewrite and a test proving the result. A diagnostic that changes existing valid code needs migration guidance and the appropriate Changesets version bump.

Use `pnpm fmt` for formatting. Run `pnpm catalog` when changing the registered rule/check inventory, then inspect the generated diff. Prefer a deterministic test or check over adding another instruction to `AGENTS.md`.

Run `pnpm security:check` after dependency changes and before release preparation. It audits development, runtime, and optional dependencies against current registry advisories and fails on registry errors. Consumer tests also audit their fresh dependency graph, since registry consumers and the workspace resolve different hosts. Do not turn a failing audit into a pass by silently ignoring an advisory.

Preserve unrelated working-tree changes. Keep the diff focused, explain what changed and why, and report the checks you actually ran with their result. If a check is blocked, state the blocker and its consequence. Do not present skipped evidence as a pass.

Implement outside ideas independently. Do not copy licensed implementation or prose. Record a greppable JSDoc `@attribution <source> (<license/inspiration>)` and name the concept in the package README. Raise ambiguous provenance before the contribution lands.

Use [the issue tracker](https://github.com/aurelienbobenrieth/harness/issues) for bugs and feature requests. Follow [the security policy](SECURITY.md) for vulnerability reports. Maintainer ownership is recorded in [CODEOWNERS](.github/CODEOWNERS); response times are best effort.

`pnpm release` only prints a preparation plan. It never publishes, tags, pushes, or versions packages. See [release readiness](docs/release-readiness.md) for the candidate/draft contract and the separate checks needed before publication can be enabled.
