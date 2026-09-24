# Contributing

**Start from a small reproduction and the user-visible behavior to change.** Bug fix → PR. Taste-dependent policy → [issue](https://github.com/aurelienbobenrieth/harness/issues) first. Vulnerability → [security policy](SECURITY.md).

## Setup and checks

```sh
pnpm install --frozen-lockfile   # Node ^22.19.0 || ^24.11.0, pnpm@11.9.0 (packageManager)
pnpm check                       # always, before review
pnpm fmt                         # formatting
pnpm catalog                     # rule/check inventory changed; inspect the diff
pnpm test:package                # exports, metadata, dependency ranges, generated output, consumer behavior
                                 # (consumer tests audit their own fresh graph)
pnpm test:compatibility baseline # dependency support (and `current`)
pnpm security:check              # deps changed: dev/runtime/optional deps vs registry advisories; fails on registry errors
```

Release preparation needs all of the above except `fmt` and `catalog`. **Never silence an advisory to turn an audit green.**

## A new rule ships as one unit

In the narrowest reusable package: implementation · registration · fires + stays-silent tests · README trigger · changeset. Autofix: exactly one safe mechanical rewrite, tested. Flags existing valid code: migration guidance + the right version bump. **Prefer a test or check over another `AGENTS.md` instruction.**

Oxlint rules share AST helpers (`@aurelienbbn/oxlint-kit/ast`) and the rule test harness (`@aurelienbbn/oxlint-kit/testing`) from `internal/oxlint-kit`: a private devDependency that tsdown bundles into each plugin, never a runtime dependency.

## Re-implement, never copy

No licensed implementation or prose. Add a greppable JSDoc `@attribution <source> (<license/inspiration>)`, name the concept in the package README, and raise ambiguous provenance **before** it lands.

## Report evidence, not hope

Keep the diff focused; preserve unrelated working-tree changes. State what changed, why, and each check run with its result, or its blocker and consequence. **Skipped evidence is never a pass.**

`pnpm release` only prints a plan; publishing happens only in the approval-gated release workflow ([release](docs/release-readiness.md)). [CODEOWNERS](.github/CODEOWNERS); best-effort response times.
