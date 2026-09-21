# @aurelienbbn/agentlint-plugin-xstate

Private draft. Development links to the sibling agentlint workspace; packed evidence uses the reviewed local archive; public agentlint 0.1.5 exposes an incompatible API. See the [compatibility evidence](../../docs/compatibility.md#private-draft-boundary).

Custom agentlint rules for XState v5 machines and actors. Deterministic triggers, judgment resolutions. Mechanical, setup-aware checks live in `@aurelienbbn/oxlint-plugin-xstate`; `eslint-plugin-xstate` does not analyse `setup().createMachine()` machines. This plugin covers the review-level questions a linter cannot decide.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

- `spawned-actor-release` - triggers once per machine definition (`createMachine`, `setup(...).createMachine`, a stored `setup(...)`, `createStateConfig`) that contains `spawnChild(...)`/`enqueue.spawnChild(...)` or `spawn(...)` inside an `assign`. The judge pairs every spawn with a reachable `stopChild` and the removal of its ref from context, including list-removal transitions; bounded parent-lifetime actors pass with the bound stated. In `xstatePreset`, not in `starterPreset`.
- `persisted-snapshot-compat` - triggers on `getPersistedSnapshot()` calls and on `createActor`/`useActor`/`useMachine`/`useActorRef` calls whose options object carries a `snapshot` key. The judge checks versioned storage, a restore that falls back to a fresh actor, JSON-serialisable context, no reliance on replayed entry actions, and named actor `src`. In `xstatePreset`, not in `starterPreset`.
- `derived-boolean-context` - triggers on `assign(...)`, `enqueue.assign(...)` and setup-bound `<x>.assign(...)` calls, on the initial `context` of a `createMachine` config and on `types.context` (reported once when both declare the same field), for `can|is|has*` flags and for `status|state|step|phase|mode` fields holding a string literal or string union.
- `actor-cleanup` - triggers on `createActor(...)` outside `**/*.{test,spec}.*`. The checklist covers exit actions not running on an external `stop()`, React ownership through `useActorRef`/`useMachine`/`createActorContext`, and the unsubscribe check relaxed once `stop()` is proven.
- `machine-failure-coverage` - triggers per `invoke` without `onError` or with an empty `onError`, and per `spawnChild(...)`/`spawn(...)` call in a machine whose text has no `xstate.error` transition, even when every `invoke` is covered; the whole-machine fallback remains for promise/callback logic with neither.

## Configuration

Every rule exports a `defineX(options)` factory next to its default instance. Options: `machine-failure-coverage` (`machineDefinitionPattern`, `invokeMarkerPattern`, `errorHandlingMarkerPattern`, `spawnCallPattern`, `spawnErrorMarkerPattern`), `actor-cleanup` (`actorStartPattern`), `derived-boolean-context` (`contextFlagPattern`, `stateMirrorPattern`, `machineFilePattern` — tested against the file source to gate the rule to machine files), `spawned-actor-release` (`machineCalleePattern`, `spawnChildCallPattern`), `persisted-snapshot-compat` (`persistCalleePattern`, `restoreCalleePattern` — both tested against the callee text). The machine trigger anchors on the `createMachine` call (bare, chained on `setup(...)`, or on a stored setup result), so `setup().createMachine()` yields one finding, not two.

## Preset

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { xstatePreset } from "@aurelienbbn/agentlint-plugin-xstate";

export default defineConfig({ extends: [xstatePreset] });
```

## Contract boundaries and migration

Failure coverage is reviewed per invocation. `onSnapshot` does not cover failure, and pure machines do not need a fabricated error state. Actor cleanup follows creation and lifetime ownership; injected or parent-owned actors need not stop themselves. Boolean context is a review prompt, because naming alone cannot establish derivability. Spawn release and snapshot compatibility are review prompts too: pairing a spawn with its stop across transitions, and reading storage code and context types across files, is not syntactic. `actor-cleanup`, `spawned-actor-release` and `persisted-snapshot-compat` exclude `**/*.{test,spec}.*` by default; rebind with your own `exclude` to review tests. Migration: `derived-boolean-context` and `machine-failure-coverage` report more sites than before (standard revision 2, detector version 2), so earlier acceptances need a fresh review.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                  | Trigger or review scope                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `actor-cleanup`             | Flags actor creation sites that need lifecycle-cleanup review.                                                                     |
| `derived-boolean-context`   | Flags assign() calls and machine context declarations that cache availability booleans or string-enum copies of the finite state.  |
| `machine-failure-coverage`  | Flags invoked actors without a real onError transition and spawned actors without an xstate.error handler for failure-path review. |
| `persisted-snapshot-compat` | Flags sites that persist or restore an actor snapshot so stored state is reviewed for versioning, fallback and serialisability.    |
| `spawned-actor-release`     | Flags machine definitions that spawn actors so every spawn is reviewed for a matching stop and ref removal.                        |

### Credited concepts

- ai-automation by Sandro Maglione (inspiration, independently re-implemented)

<!-- harness-catalog:end -->

## Current rule contract

Rules expose `lifecycle`, `standard` (revision), `detector` (version), and `binding` (id, authority, scope, material options). Presets use arrays of bindings: `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`. Configure repeated uses with distinct binding ids. Repository owners choose scope and can raise authority to `human`; defaults permit agent acceptance. Acceptance requires matching current evidence and authority. `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser.

## Start with a focused review

The opt-in `starterPreset` includes `actorCleanup`, `machineFailureCoverage`. Install a compatible local draft of this package and agentlint, then run:

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-xstate#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` preserves an existing config and prints the package installation command. It never installs packages itself. Inspect and calibrate the bindings before making `agentlint check --all` required. This gradual onboarding takes conceptual inspiration from desloppify by Peter O'Malley; no code or guidance was copied.
