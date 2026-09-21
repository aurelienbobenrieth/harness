# Completion decisions — 2026-09-21

This record closes the design questions left open by the September review sessions. It separates deliberate scope from unfinished implementation.

## Repository policy

- `tsconfig-strictness` remains opt-in. The check evaluates resolved compiler options only when a consumer passes `tsconfigStrictness: {}` (or narrower options). Enabling it implicitly would change existing consumers and make the general conformance preset depend on TypeScript workspace layout.
- This repository does not consume its own exported strict lint preset at the root. Rule fixtures intentionally contain violations and the root also owns scripts, policies, and package build inputs that are not representative application code. Packed clean and broken consumers remain the executable preset acceptance test.
- Production-source quality is now enforced by `pnpm quality:check`: Knip must report no dead files or exports, and jscpd must remain at or below the reviewed 28-clone baseline. Tests and fixtures are excluded because repeated assertions are often clearer than a cross-package testing abstraction.
- Test helpers stay package-owned. A shared test-support package would couple otherwise independent plugins around non-public test machinery; no production abstraction is justified by test-only duplication.

## Failure-policy ownership

- Keep `effect/no-effect-ordie`; do not add `effect/error-channel-earns-keep`. Erasing a typed Effect failure with `orDie` is a local, mechanically observable action. Proving that an error channel has enough distinct consumers to “earn” its existence needs a repository-wide tag census, is not expressible by the current Agentlint contract, and conflicts with the existing typed-failure direction.
- `core/no-discarded-caught-error` owns deterministic loss of a caught value. `core/boundary-resilience` reviews the operational policy around boundary retries, logging, and recovery. `core/fallback-masks-failure` stays opt-in and outside presets because fallback intent is contextual. The overlap is layered and does not warrant merging diagnostics.

## Agentlint contract boundary

`mutation-state-coverage` is implemented in the TanStack Query strict preset. Four researched rules are deliberately deferred, not partially implemented:

| Proposed rule            | Missing engine capability                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| `bolted-on-branch`       | Parsed before/after trees and unfiltered change metadata                  |
| `unexercised-option`     | Cross-file facts with stable locations and contributor-aware fingerprints |
| `bucket-module-cohesion` | Cross-file reporting plus import resolution                               |
| `error-path-coverage`    | Per-file derived source/test dependencies included in fingerprints        |

The current engine deletes syntax trees before its repository-level `after()` phase, accepts only fixed rule dependencies, and exposes change snapshots as text. Regex or filesystem side channels would create false confidence and stale accepted findings. These rules belong after an Agentlint contract revision with two-phase repository findings, derived dependencies, and parser access for change snapshots.

## Delivery boundary

- Changes are split into reviewable local commits after the complete validation gate passes.
- Package publication remains disabled. `pnpm release` continues to produce a preparation plan only.
- GitHub private vulnerability reporting, vulnerability alerts, and Dependabot security updates were enabled and API-verified. The existing zero-approval branch policy remains deliberate while the repository has one direct collaborator and sole CODEOWNER; the required fresh `Validate` status still applies to administrators.
