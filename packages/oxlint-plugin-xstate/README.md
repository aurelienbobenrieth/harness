# @aurelienbbn/oxlint-plugin-xstate

[![npm](https://img.shields.io/npm/v/@aurelienbbn/oxlint-plugin-xstate)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-xstate) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/oxlint-plugin-xstate)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-xstate) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/oxlint-plugin-xstate)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-xstate/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/oxlint-plugin-xstate)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-xstate/package.json)

**17 oxlint rules for XState v5 and v6 alpha machines (with `@xstate/effect`), built with `setup().createMachine()`, the shape `eslint-plugin-xstate` can't see.**

> v6 support is checked against `xstate@6.0.0-alpha.64`, `@xstate/effect@0.1.0-alpha.6` and `@xstate/react@7.0.0-alpha.4`; alpha APIs can move between releases.

|                                    | `eslint-plugin-xstate`                   | this plugin               |
| ---------------------------------- | ---------------------------------------- | ------------------------- |
| `setup().createMachine()` machines | ❌ bare `createMachine` callee only      | ✅ setup-aware            |
| XState v6 alpha + `@xstate/effect` | ❌                                       | ✅ v5 and v6 spellings    |
| maintained                         | ❌ last published 2023-12, ESLint 8 peer | ✅ oxlint >=1.82.0 <2.0.0 |

```sh
pnpm add -D @aurelienbbn/oxlint-plugin-xstate oxlint
```

```json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-xstate"],
  "rules": {
    "xstate/require-setup-create-machine": "error",
    "xstate/no-context-mutation": "error",
    "xstate/require-effect-actor": "error",
    "xstate/no-deferred-enqueue": "error"
  }
}
```

No preset, no autofix: enable each rule by name.

## 13 solid, 2 MAYBE, 2 deprecated

```text
solid       █████████████  13   error
MAYBE       ██              2   off or warn: no-unreachable-transition · promise-actor-abort-signal
deprecated  ██              2   v5 only: no-imperative-action-creator · prefer-send-to
```

**`no-imperative-action-creator` and `prefer-send-to` are deprecated since 0.2.0.** XState v6 removes the action creators and `sendParent` (importing one is a type error); both rules still work on v5 until you migrate.

`no-direct-named-action` contradicts the upstream v6 docs, which show direct `actions.x(...)` calls. It reports them anyway: in alpha.64 a direct call ran twice for one `send`, and also ran during pure `transition()` and `snapshot.can()`.

## What fires

```ts
setup({ types: {} }).createMachine({
  entry: ({ context }) => {
    assign({ count: context.count + 1 });
  }, // ❌ no-imperative-action-creator: builds an action, runs nothing
});
setup({ types: {} }).createMachine({
  entry: assign({ count: ({ context }) => context.count + 1 }), // ✅
});

actorRef.send({ type: "ADD_ITEM", id: "x" }); // ❌ require-event-satisfies
actorRef.send({ type: "ADD_ITEM" } satisfies CartEvent); // ✅

setup({}).createMachine({ id: "app.cart" });
// ❌ require-setup-create-machine: neither `types` (v5) nor `schemas` (v6)

// v6 alpha / @xstate/effect
createActor(setupEffect({ actors }).createMachine(config)); // ❌ require-effect-actor: status 'error', use createEffectActor
on: { SAVE: (_, enq) => { setTimeout(() => enq.raise({ type: "SAVED" }), 100); } } // ❌ no-deferred-enqueue
on: { SAVE: (_, enq) => { enq.raise({ type: "SAVED" }, { delay: 100 }); } } // ✅
after: { "5m": { target: "expired" } } // ❌ valid-duration: write "PT5M" or 300000
```

## `require-event-satisfies` matters where types are erased

```text
setup({ types }) machine  ──▶  TypeScript already checks the payload  → rule redundant
sendTo / sendParent targets,
AnyActorRef, untyped refs ──▶  event type erased                      → rule is the only check
```

**Fully typed codebase? Narrow `sendCalleeNames` to the erased senders.** `satisfies unknown` / `any` isn't evidence; the rule enforces syntax, not the intended event union.

<details>
<summary>Options and defaults</summary>

| Rule                      | Option                                                                                                                                                                                                                              | Default                                                                                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `machine-naming`          | `pattern`                                                                                                                                                                                                                           | `^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$` (generic dotted kebab-case namespace, not oio-specific)                                                                                                                                                                               |
| `named-actor-src`         | v5 files: `invoke.src` or first argument of `spawnChild` / `enqueue.spawnChild` that is a call, a function, or an identifier not bound to a string constant; v6: first argument of `enq.spawn` that is a call, `new`, or a function | `false`; `true` also checks `spawn(...)` from an `assign` argument or a v6 context factory. ⏭️ v6 files (no v5-only import, no `types`): `invoke.src`, identifiers                                                                                                         |
|                           | `guards`                                                                                                                                                                                                                            | `false`; `true` also reports inline function `guard` values                                                                                                                                                                                                                |
| `no-context-mutation`     | `allowCollectionMethods`                                                                                                                                                                                                            | `false`; `true` exempts Map/Set `set` / `add` / `delete` / `clear`; v6 `createLogic` / `createAsyncLogic` / `<setup>.createInvoke` / `createStateConfig(path, config)`, `setupEffect` (`@xstate/effect`), `.provide` / `.extend`                                           |
| `require-event-satisfies` | `sendCalleeNames`                                                                                                                                                                                                                   | `["send", "raise", "sendTo", "sendParent", "emit", "sendBack"]`; v6 `enq.raise` / `sendTo` / `emit` / `sendBack` on the handler's second parameter; `@xstate/effect` `send(actor, ev)` / `send(ev)`; `.send` on `<system>.createActor` and `yield* createEffectActor` refs |

</details>

<details>
<summary>Exact triggers and scope per rule</summary>

| Rule                           | ❌ Fires on                                                                                                                                                                                                                                                                                                         | Matched / ⏭️ skipped                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-imperative-action-creator` | ⚠️ deprecated (v5 only). `assign` / `raise` / `sendTo` / `sendParent` / `forwardTo` / `emit` / `cancel` / `stopChild` / `stop` / `spawnChild` / `log` / `enqueueActions` as a discarded statement (also `void` / `await`ed), or returned by a concise arrow in `entry` / `exit` / `actions` or `setup({ actions })` | creators imported from `xstate`, destructured from or called on a `setup()` result                                                                                                                                                                                                                                                         |
| `no-context-mutation`          | assignment, `++` / `--`, `delete`, or a mutating method on a path rooted at `context` or `snapshot.context` / `getSnapshot().context`                                                                                                                                                                               | `context` destructured by an implementation function inside `setup` / `createMachine` / `createStateConfig` / `createAction` / `assign` / `enqueueActions`. Methods: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`, `set`, `add`, `delete`, `clear`. ⏭️ Map/Set with `allowCollectionMethods: true` |
| `no-machine-in-render`         | `createMachine`, `<setup>.createMachine` (incl. `setupEffect`, `system.setup`), `createActor`, `<system>.createActor`, `interpret`, `createActorAtoms` directly in a component or hook body                                                                                                                         | nearest enclosing function is a component (`/^[A-Z]/`) or hook (`/^use[A-Z]/`), `memo` / `forwardRef` included, in a file importing `react` or `@xstate/react`. ⏭️ nested callbacks (`useMemo`, `useEffect`, handlers), `machine.provide(...)`                                                                                             |
| `named-actor-src`              | `invoke.src` or first argument of `spawnChild` / `enqueue.spawnChild` that is a call, a function, or an identifier not bound to a string constant                                                                                                                                                                   | `invoke.src` in `createMachine` / `<setup>.createMachine` / `<setup>.createStateConfig` config. ⏭️ member expressions                                                                                                                                                                                                                      |
| `stable-selector-result`       | inline `useSelector` or `actor.select` selector returning a fresh object/array, no comparator argument                                                                                                                                                                                                              | `useSelector` from `@xstate/react`, `@xstate/store-react`, legacy `@xstate/store/react`, `<ActorContext>.useSelector`. Fresh = object/array literal, `.map` / `.filter` / `.flatMap` / `.toSorted`, `Object.keys` / `values` / `entries`; `.select` on `createActor` / `<system>.createActor` / `useActorRef` refs. ⏭️ atoms `.select`     |
| `require-setup-create-machine` | `createMachine`, `setup`, `setupEffect` or `<system>.setup` whose literal config has neither `types` nor `schemas`, unless every `.createMachine` / `.extend` on that setup in the file declares them                                                                                                               | named and namespace imports, aliases, lexical shadows. ⏭️ `setup(...)` arguments not statically readable (identifiers, spreads)                                                                                                                                                                                                            |
| `require-event-satisfies`      | an object-literal event sent without `satisfies`                                                                                                                                                                                                                                                                    | `send`, `raise`, `sendTo`, `sendParent`, `emit` from `xstate`; `enqueue.raise` / `sendTo` / `sendParent` / `emit` on `enqueueActions`' `enqueue`; `.send` on refs from `createActor`, `useActorRef`, `<ActorContext>.useActorRef()`, and the `useMachine` / `useActor` tuple (`send` and actor-ref slots). ⏭️ unrelated `.send` methods    |
| `machine-naming`               | a present static machine id failing `pattern`                                                                                                                                                                                                                                                                       | ⏭️ absent ids; `createStateConfig` (state-node ids, not machine ids)                                                                                                                                                                                                                                                                       |
| `no-unreachable-transition`    | an unguarded branch not last in `always`, `on.<EVENT>`, `after.<DELAY>`, `onDone`, `onError` arrays (v5); a targetless unconditional `always` with `actions` or `context`, or a v6 `always` function returning a targetless `{ context }` patch on every path (infinite loop)                                       | ⏭️ branches with spreads or computed keys                                                                                                                                                                                                                                                                                                  |
| `prefer-send-to`               | ⚠️ deprecated (v5 only). `sendParent` imported from `xstate`, and `<object>.sendParent(...)` such as `enqueue.sendParent`                                                                                                                                                                                           |                                                                                                                                                                                                                                                                                                                                            |
| `promise-actor-abort-signal`   | inline `fromPromise`, `createAsyncLogic({ run })` or `<setup>.createInvoke({ src })` logic calling global `fetch` for a read (no init, or literal `GET` / `HEAD`) never referencing `signal`                                                                                                                        | ⏭️ wrapped HTTP clients are invisible to it                                                                                                                                                                                                                                                                                                |
| `require-effect-actor`         | `createActor` / `useMachine` / `useActor` / `useActorRef` / `createActorContext` given `fromEffect*` logic or a `setupEffect` machine (inline, through a `const`, `.provide`, `.extend`)                                                                                                                            | ⏭️ `createEffectActor`, `createActorAtoms`                                                                                                                                                                                                                                                                                                 |
| `no-discarded-effect`          | `enq(() => Effect.…)`, or an Effect returned from `entry` / `exit` / a transition                                                                                                                                                                                                                                   | `Effect` imported from `effect`. ⏭️ `Effect.run*` / `Effect.is*`, `enq(actions.x, params)`                                                                                                                                                                                                                                                 |
| `no-deferred-enqueue`          | `enq` / `enq.*` inside a timer, promise, listener or enqueued-effect callback, or after `await`, in a v6 handler                                                                                                                                                                                                    | ⏭️ synchronous callbacks (`forEach`), `createAsyncLogic` `run`                                                                                                                                                                                                                                                                             |
| `no-direct-named-action`       | `actions.x(...)` called directly in a v6 handler body                                                                                                                                                                                                                                                               | `{ actions }` / `{ actions: a }` / `args.actions`. ⏭️ inside `enq(() => …)`, action implementations, context factory                                                                                                                                                                                                                       |
| `valid-duration`               | duration-like `after` key, `timeout`, or `createAsyncLogic` timeout string XState can't parse and no `delays` entry names                                                                                                                                                                                           | accepts ms numbers, `<n>ms`, `<n>s`, ISO 8601 (`PT5M`). Report only                                                                                                                                                                                                                                                                        |
| `no-persist-live-snapshot`     | `JSON.stringify` of `getSnapshot()`, a `useMachine` snapshot, or a `subscribe` listener snapshot                                                                                                                                                                                                                    | ⏭️ `getPersistedSnapshot()`, `getSnapshot().context`, receivers not provably actors                                                                                                                                                                                                                                                        |

Config-walking rules treat the argument of `<setup>.createStateConfig(...)` (v6: the second argument of `createStateConfig(path, config)`) as machine config. v6 rules recognise handlers as the functions in `entry` / `exit` / `always` / `on` / `after` / `onDone` / `onError` / `onSnapshot` / `onTimeout` / `to` slots, with `enq` as their second parameter.

**Not shipped: `no-deprecated-xstate-api`.** Type-aware `typescript/no-deprecated` already reports `interpret`, `stop`, `getNextSnapshot` and the other `@deprecated` exports.

</details>

**Credit:** `no-imperative-action-creator` and `no-unreachable-transition` re-implement `eslint-plugin-xstate`'s `no-imperative-action` and `no-infinite-loop` ideas (Richard Laffers); `no-discarded-effect` re-implements the idea of statelyai/xstate's `no-inline-effect` (MIT). No code copied.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                     | Trigger or review scope                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `machine-naming`               | Require XState machine ids to follow the configured naming convention.                                                                                                                       |
| `named-actor-src`              | Require invoke.src and spawnChild() (XState v5) and enq.spawn() (XState v6) to reference actors declared in setup({ actors }) by key instead of inline actor logic.                          |
| `no-context-mutation`          | Forbid in-place mutation of XState context (assignments, delete, and mutating array/Map/Set methods on context or snapshot.context).                                                         |
| `no-deferred-enqueue`          | Forbid calling a v6 handler's enq from a timer, promise, listener, or enqueued-effect callback, or after an await.                                                                           |
| `no-direct-named-action`       | Forbid calling a named action directly in a v6 handler body instead of enq(actions.name, params).                                                                                            |
| `no-discarded-effect`          | Forbid Effects built inside an inline enq(() => ...) effect or returned from a machine handler, where XState discards them unrun.                                                            |
| `no-imperative-action-creator` | Forbid XState action creators (assign, raise, sendTo, ...) called as discarded statements or returned from inline action functions, where they are silent no-ops.                            |
| `no-machine-in-render`         | Forbid createMachine, setup().createMachine, createActor, system.createActor, interpret and createActorAtoms calls directly in a React component or hook body.                               |
| `no-persist-live-snapshot`     | Forbid JSON.stringify of an actor's live snapshot (getSnapshot(), a useMachine snapshot, a subscribe listener's snapshot) instead of getPersistedSnapshot().                                 |
| `no-unreachable-transition`    | Forbid an unguarded transition placed before other branches of the same transition array (XState v5), and targetless always transitions that re-run their actions or context update forever. |
| `prefer-send-to`               | Prefer sendTo() with an actor ref passed through input over sendParent() and enqueue.sendParent().                                                                                           |
| `promise-actor-abort-signal`   | Require inline async actor logic (fromPromise, createAsyncLogic run, createInvoke src) that calls fetch for a read to forward the actor's abort signal.                                      |
| `require-effect-actor`         | Require @xstate/effect logic (fromEffect*, setupEffect machines) to be started with createEffectActor instead of createActor or @xstate/react hooks.                                         |
| `require-event-satisfies`      | Require object-literal events sent to machines to be checked with satisfies.                                                                                                                 |
| `require-setup-create-machine` | Require XState machines to declare types (XState v5) or schemas (XState v6) on createMachine(), setup(), setupEffect() or system.setup().                                                    |
| `stable-selector-result`       | Forbid inline useSelector and actor.select selectors that return a fresh object or array when no comparator argument is passed.                                                              |
| `valid-duration`               | Require after keys, state timeouts, and createAsyncLogic timeouts written as duration strings to use a format XState parses, unless they name a declared delay.                              |

### Credited concepts

- ai-automation by Sandro Maglione (inspiration, independently re-implemented)
- eslint-plugin-xstate no-imperative-action by Richard Laffers (concept)
- eslint-plugin-xstate no-infinite-loop by Richard Laffers (concept)
- statelyai/xstate no-inline-effect (MIT; concept, independently implemented)

<!-- harness-catalog:end -->
