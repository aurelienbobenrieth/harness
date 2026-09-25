# @aurelienbbn/agentlint-plugin-xstate

**5 agentlint reviews for XState v5: every actor has an owner, every failure a path, every persisted snapshot a version.**

> [!WARNING]
> Requires the engine `@aurelienbbn/agentlint` `>=0.3.0 <0.4.0` as a peer. [Evidence](../../docs/compatibility.md#agentlint-engine).

```text
oxlint-plugin-xstate      mechanical, setup-aware checks
agentlint-plugin-xstate   review questions a linter can't decide   ◀── you are here
eslint-plugin-xstate      doesn't analyse setup().createMachine() machines
```

## Quick start

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-xstate#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` keeps an existing config and prints the install command; never installs. **Calibrate bindings before requiring `agentlint check --all`.**

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { xstatePreset } from "@aurelienbbn/agentlint-plugin-xstate";

export default defineConfig({ extends: [xstatePreset] });
```

## Rules

| Rule                        | `xstatePreset` | `starterPreset` | Authority | Standard rev | Detector | Skips tests |
| --------------------------- | :------------: | :-------------: | --------- | :----------: | :------: | :---------: |
| `actor-cleanup`             |       ✅       |       ✅        | agent     |      2       |    1     |     ✅      |
| `machine-failure-coverage`  |       ✅       |       ✅        | agent     |     2 ⚠️     |    2     |             |
| `derived-boolean-context`   |       ✅       |                 | agent     |     2 ⚠️     |    2     |             |
| `spawned-actor-release`     |       ✅       |                 | agent     |      1       |    1     |     ✅      |
| `persisted-snapshot-compat` |       ✅       |                 | agent     |      1       |    1     |     ✅      |

Presets ignore `**/*.d.ts`. Skips tests = excludes `**/*.{test,spec}.*`; rebind `exclude` to review tests. **⚠️ Revision 2 reports more sites: earlier acceptances need a fresh review.**

```ts
createMachine({ invoke: { src: load } }); // ❌ machine-failure-coverage: no onError
const actor = createActor(machine); // ❌ actor-cleanup: who stops it?
setup({}).createMachine({ entry: spawnChild("sync", { id: "sync" }) }); // ❌ spawned-actor-release: paired stopChild?
save(actor.getPersistedSnapshot()); // ❌ persisted-snapshot-compat
setup({}).createMachine({ context: { isLoading: false } }); // ❌ derived-boolean-context
```

Every rule exports a `defineX(options)` factory beside its default instance. `setup().createMachine()` yields one finding, not two: the trigger anchors on the `createMachine` call (bare, chained on `setup(...)`, or on a stored setup result).

<details>
<summary><code>machine-failure-coverage</code>: per invoke, per spawn</summary>

```ts
createMachine({ invoke: { src: "load", onError: {} } }); // ❌ fires: empty onError
createMachine({ invoke: { src: "load", onError: "failed" }, entry: spawnChild("sync", { id: "sync" }) }); // ❌ fires: spawn, no xstate.error
createMachine({ invoke: { src: load, onError: "error" } }); // ✅ silent
```

Fires per `invoke` without a real `onError` (reviewed per invocation), and per `spawnChild(...)` / `spawn(...)` in a machine whose text has no `xstate.error` transition, even when every `invoke` is covered. Whole-machine fallback remains for promise/callback logic with neither. `onSnapshot` is not a failure path; pure machines don't need a fabricated error state.

Options: `machineDefinitionPattern`, `invokeMarkerPattern`, `errorHandlingMarkerPattern`, `spawnCallPattern`, `spawnErrorMarkerPattern`.

</details>

<details>
<summary><code>actor-cleanup</code>: whoever creates an actor stops it</summary>

Fires on `createActor(...)`. Injected or parent-owned actors need not stop themselves.

- [ ] exit actions don't run on an external `stop()`
- [ ] React ownership goes through `useActorRef` / `useMachine` / `createActorContext`
- [ ] unsubscribe: relaxed once `stop()` is proven

Options: `actorStartPattern`.

</details>

<details>
<summary><code>spawned-actor-release</code>: once per machine definition</summary>

```ts
createMachine({ on: { ADD: { actions: assign({ ref: ({ spawn }) => spawn(todoMachine) }) } } }); // ❌ fires
setup({}).createMachine({ entry: spawnChild("sync", { id: "sync" }) }); // ❌ fires, once
const child = spawn("git", ["status"]);
assign({ ref: child }); // ✅ silent: not a machine
```

Fires once per machine definition (`createMachine`, `setup(...).createMachine`, a stored `setup(...)`, `createStateConfig`) containing `spawnChild(...)` / `enqueue.spawnChild(...)`, or `spawn(...)` inside an `assign`. The judge pairs every spawn with a reachable `stopChild` and ref removal from context, list-removal transitions included. Bounded parent-lifetime actors pass with the bound stated. Review prompt only: pairing across transitions is not syntactic.

Options: `machineCalleePattern`, `spawnChildCallPattern`.

</details>

<details>
<summary><code>persisted-snapshot-compat</code>: stored state outlives its writer</summary>

```ts
createActor(machine, { snapshot: JSON.parse(raw) }); // ❌ fires
useMachine(machine, { snapshot }); // ❌ fires
createActor(machine, { input: { id } }); // ✅ silent
render(view, { snapshot: actor.getSnapshot() }); // ✅ silent: not an actor call
```

Fires on `getPersistedSnapshot()` and on `createActor` / `useActor` / `useMachine` / `useActorRef` with a `snapshot` key. Review prompt only: storage code and context types span files. The judge checks:

- [ ] versioned storage
- [ ] restore falls back to a fresh actor
- [ ] context is JSON-serialisable
- [ ] no reliance on replayed entry actions
- [ ] actor `src` is named

Options: `persistCalleePattern`, `restoreCalleePattern` (both tested against the callee text).

</details>

<details>
<summary><code>derived-boolean-context</code>: flags and state mirrors</summary>

```ts
createMachine({});
assign({ canSubmit: true }); // ❌ fires
setup({ types: { context: {} as { status: "idle" | "loading" } } }).createMachine({}); // ❌ fires
createMachine({});
assign({ count: 1 }); // ✅ silent
createMachine({ context: { status: initialStatus, items: [] } }); // ✅ silent: not a literal
```

Fires on `assign(...)`, `enqueue.assign(...)`, setup-bound `<x>.assign(...)`, the initial `context` of a `createMachine` config, and `types.context` (once when both declare the same field), for `can|is|has*` flags and `status|state|step|phase|mode` fields holding a string literal or string union. A review prompt, not a verdict: naming alone can't establish derivability.

Options: `contextFlagPattern`, `stateMirrorPattern`, `machineFilePattern` (tested against the file source; gates the rule to machine files).

</details>

<details>
<summary>Agentlint rule contract</summary>

| Fact                | Detail                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| rule shape          | `lifecycle`, `standard` (revision), `detector` (version), `binding` (id, authority, scope, material options)                  |
| composing           | `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`; repeated uses need distinct binding ids |
| authority           | defaults permit agent acceptance; repository owners choose scope and can raise authority to `human`                           |
| accepting a finding | requires matching current evidence **and** authority                                                                          |
| fixtures            | `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser                           |

</details>

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

## Credits

`starterPreset` onboarding: conceptual inspiration from desloppify by Peter O'Malley; no code or guidance copied.
