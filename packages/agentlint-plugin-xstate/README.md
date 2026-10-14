# @aurelienbbn/agentlint-plugin-xstate

[![npm](https://img.shields.io/npm/v/@aurelienbbn/agentlint-plugin-xstate)](https://www.npmjs.com/package/@aurelienbbn/agentlint-plugin-xstate) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/agentlint-plugin-xstate)](https://www.npmjs.com/package/@aurelienbbn/agentlint-plugin-xstate) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/agentlint-plugin-xstate)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/agentlint-plugin-xstate/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/agentlint-plugin-xstate)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/agentlint-plugin-xstate/package.json)

**7 agentlint reviews for XState v5 and v6 alpha (with `@xstate/effect`): every actor has an owner, every failure a path, every persisted snapshot a version.**

> v6 support is checked against `xstate@6.0.0-alpha.64` and `@xstate/effect@0.1.0-alpha.6`; alpha APIs can move between releases.

> [!WARNING]
> Requires the engine `@aurelienbbn/agentlint` `>=0.3.0 <0.9.0` as a peer. [Evidence](../../docs/compatibility.md#agentlint-engine).

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
| `actor-cleanup`             |       ✅       |       ✅        | agent     |     3 ⚠️     |    2     |     ✅      |
| `machine-failure-coverage`  |       ✅       |       ✅        | agent     |     3 ⚠️     |    3     |             |
| `derived-boolean-context`   |       ✅       |                 | agent     |     3 ⚠️     |    3     |             |
| `spawned-actor-release`     |       ✅       |                 | agent     |     2 ⚠️     |    2     |     ✅      |
| `persisted-snapshot-compat` |       ✅       |                 | agent     |     2 ⚠️     |    1     |     ✅      |
| `spawn-id-collision`        |       ✅       |                 | agent     |      1       |    1     |             |
| `effect-actor-observed`     |       ✅       |                 | agent     |      1       |    1     |             |

Presets ignore `**/*.d.ts`. Skips tests = excludes `**/*.{test,spec}.*`; rebind `exclude` to review tests. **⚠️ A raised revision changes the guidance and may report more sites (v6 spellings): earlier acceptances need a fresh review.**

```ts
createMachine({ invoke: { src: load } }); // ❌ machine-failure-coverage: no onError
const actor = createActor(machine); // ❌ actor-cleanup: who stops it?
setup({}).createMachine({ entry: spawnChild("sync", { id: "sync" }) }); // ❌ spawned-actor-release: paired stopChild?
save(actor.getPersistedSnapshot()); // ❌ persisted-snapshot-compat
setup({}).createMachine({ context: { isLoading: false } }); // ❌ derived-boolean-context

// v6 alpha / @xstate/effect
createMachine({
  on: {
    ADD: (_, enq) => {
      enq.spawn("todo", { id: "todo" });
    },
  },
}); // ❌ spawn-id-collision, spawned-actor-release
const actor = yield * createEffectActor(machine); // ❌ effect-actor-observed: nothing joins or waits on it
```

Every rule exports a `defineX(options)` factory beside its default instance. `setup().createMachine()` yields one finding, not two: the trigger anchors on the `createMachine` call (bare, chained on `setup(...)`, or on a stored setup result).

<details>
<summary><code>machine-failure-coverage</code>: per invoke, per spawn</summary>

```ts
createMachine({ invoke: { src: "load", onError: {} } }); // ❌ fires: empty onError
createMachine({ invoke: { src: "load", onError: "failed" }, entry: spawnChild("sync", { id: "sync" }) }); // ❌ fires: spawn, no xstate.error
createMachine({ invoke: { src: load, onError: "error" } }); // ✅ silent
```

Fires per `invoke` without a real `onError` (reviewed per invocation; v6 `createInvoke({...})` is unwrapped, and an enclosing state's `onError` covers it), and per `spawnChild(...)` / `enq.spawn(...)` / `spawn(...)` with no actor-error handling: a root `onError` (v6), an `xstate.error.actor` transition, or `subscribeTo(ref, { error })`. v6 logic creators (`createAsyncLogic`, `createCallbackLogic`, …) and `fromEffect*` count as failure sources. The guidance differs per version: v6 `onError` recovers action and spawned-child errors, v5 doesn't. Whole-machine fallback remains for promise/callback logic with neither. `onSnapshot` is not a failure path; pure machines don't need a fabricated error state.

Options: `machineDefinitionPattern`, `invokeMarkerPattern`, `errorHandlingMarkerPattern`, `spawnCallPattern`, `spawnErrorMarkerPattern`.

</details>

<details>
<summary><code>actor-cleanup</code>: whoever creates an actor stops it</summary>

Fires on `createActor(...)` and `system.createActor(...)`; `createEffectActor(...)` (owned by its Effect Scope) and `createActorAtoms(...)` (owned by its atom registry) get their own message. Injected or parent-owned actors need not stop themselves.

- [ ] exit actions don't run on an external `stop()` (v5 and v6); cleanup lives in `fromCallback` / `createCallbackLogic` or the async abort signal
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

Fires once per machine definition (`createMachine`, `setup(...)` / `setupEffect(...)` / `system.setup(...)` `.createMachine`, a stored setup, `createStateConfig`) containing `spawnChild(...)` / `enqueue.spawnChild(...)`, v6 `enq.spawn(...)`, or a destructured `spawn(...)` (v5 `assign`, v5/v6 context factory). The judge pairs every spawn with a reachable `stopChild` / `enq.stop(ref)` and ref removal from context (v6: a returned context patch), or handled self-completion, list-removal transitions included. Bounded parent-lifetime actors pass with the bound stated. Review prompt only: pairing across transitions is not syntactic.

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

- [ ] versioned storage (v6: machine `version` + `machineVersions()` migration; v5 snapshots don't restore in v6)
- [ ] restore falls back to a fresh actor: an incompatible snapshot yields status `'error'`, it doesn't throw, so `try/catch` alone catches nothing
- [ ] persists `getPersistedSnapshot()`, never `getSnapshot()`; `@xstate/effect` actors can't be restored yet
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

Fires on `assign(...)`, `enqueue.assign(...)`, setup-bound `<x>.assign(...)`, v6 context patches (a `context` returned by a handler or set on a static transition object), the initial `context` of a `createMachine` config, and `types.context` / v6 `schemas.context` (once when both declare the same field), for `can|is|has*` flags and `status|state|step|phase|mode` fields holding a string literal or string union. A review prompt, not a verdict: naming alone can't establish derivability.

Options: `contextFlagPattern`, `stateMirrorPattern`, `machineFilePattern` (tested against the file source; gates the rule to machine files).

</details>

<details>
<summary><code>spawn-id-collision</code>: a repeatable event, a fixed id</summary>

```ts
createMachine({
  on: {
    ADD: (_, enq) => {
      enq.spawn("todo", { id: "todo" });
    },
  },
}); // ❌ fires
createMachine({
  on: {
    ADD: ({ event }, enq) => {
      enq.spawn("todo", { id: `todo-${event.id}` });
    },
  },
}); // ✅ silent
```

Fires on `enq.spawn`, `spawnChild` / `enqueue.spawnChild`, or destructured `spawn` with a fixed string `id` inside an `on.<EVENT>` handler. Spawns in `entry`, `after`, or the context factory stay silent. A second event spawns a second child under the same id: v6 errors the parent, v5 orphans the first child. The judge accepts per-child ids, a stop of the old child in the same transition, or proof the event can't repeat while the child lives.

Options: `spawnChildCallPattern`.

</details>

<details>
<summary><code>effect-actor-observed</code>: an unread Effect actor fails silently</summary>

```ts
const actor = yield * createEffectActor(machine); // ❌ fires: never joined, waited on, or returned
const actor = yield * createEffectActor(machine);
return yield * waitFor(actor, (s) => s.matches("done"), { timeout: "5 seconds" }); // ✅ silent
```

Fires on `createEffectActor(...)` bound to a variable the file never passes to `join`, `waitFor`, or `snapshots` (also through `pipe`), never subscribes to, and never returns. `emitted` doesn't count: it just ends when the actor errors. Unbound creations such as `Layer.effect(...)` stay silent.

Options: `effectActorCalleePattern`, `observerNames`.

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

| Rule/check                  | Trigger or review scope                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actor-cleanup`             | Flags actor creation sites that need lifecycle-cleanup review.                                                                                                       |
| `derived-boolean-context`   | Flags context writes (v5 assign(), v6 returned context patches) and context declarations that cache availability booleans or string-enum copies of the finite state. |
| `effect-actor-observed`     | Flags @xstate/effect actors bound by createEffectActor(...) whose outcome the file never reads with join, waitFor, snapshots or subscribe.                           |
| `machine-failure-coverage`  | Flags invoked actors without a real onError transition and spawned actors without actor-error handling for failure-path review.                                      |
| `persisted-snapshot-compat` | Flags sites that persist or restore an actor snapshot so stored state is reviewed for versioning, fallback and serialisability.                                      |
| `spawn-id-collision`        | Flags spawns with a fixed id inside an event handler, where a repeated event spawns a second child under the same id.                                                |
| `spawned-actor-release`     | Flags machine definitions that spawn actors so every spawn is reviewed for a matching stop and ref removal.                                                          |

### Credited concepts

- ai-automation by Sandro Maglione (inspiration, independently re-implemented)

<!-- harness-catalog:end -->

## Credits

`starterPreset` onboarding: conceptual inspiration from desloppify by Peter O'Malley; no code or guidance copied.
