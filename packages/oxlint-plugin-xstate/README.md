# @aurelienbbn/oxlint-plugin-xstate

[![npm](https://img.shields.io/npm/v/@aurelienbbn/oxlint-plugin-xstate)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-xstate) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/oxlint-plugin-xstate)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-xstate) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/oxlint-plugin-xstate)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-xstate/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/oxlint-plugin-xstate)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-xstate/package.json)

**11 oxlint rules for XState v5 machines built with `setup().createMachine()`, the shape `eslint-plugin-xstate` can't see.**

|                                    | `eslint-plugin-xstate`                   | this plugin               |
| ---------------------------------- | ---------------------------------------- | ------------------------- |
| `setup().createMachine()` machines | ❌ bare `createMachine` callee only      | ✅ setup-aware            |
| maintained                         | ❌ last published 2023-12, ESLint 8 peer | ✅ oxlint >=1.82.0 <2.0.0 |

```sh
pnpm add -D @aurelienbbn/oxlint-plugin-xstate oxlint
```

```json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-xstate"],
  "rules": {
    "xstate/require-setup-create-machine": "error",
    "xstate/no-imperative-action-creator": "error",
    "xstate/no-context-mutation": "error",
    "xstate/prefer-send-to": "warn"
  }
}
```

No preset, no autofix: enable each rule by name.

## 8 solid, 3 MAYBE

```text
solid   ████████   8   error
MAYBE   ███        3   off or warn: no-unreachable-transition · prefer-send-to (warn) · promise-actor-abort-signal
```

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
// ❌ require-setup-create-machine: setup() declares no `types`
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

| Rule                      | Option                   | Default                                                                                      |
| ------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `machine-naming`          | `pattern`                | `^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$` (generic dotted kebab-case namespace, not oio-specific) |
| `named-actor-src`         | `checkSpawn`             | `false`; `true` also checks `spawn(...)` taken from an `assign` argument                     |
|                           | `guards`                 | `false`; `true` also reports inline function `guard` values                                  |
| `no-context-mutation`     | `allowCollectionMethods` | `false`; `true` exempts Map/Set `set` / `add` / `delete` / `clear`                           |
| `require-event-satisfies` | `sendCalleeNames`        | `["send", "raise", "sendTo", "sendParent", "emit"]`                                          |

</details>

<details>
<summary>Exact triggers and scope per rule</summary>

| Rule                           | ❌ Fires on                                                                                                                                                                                                                                                                                | Matched / ⏭️ skipped                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-imperative-action-creator` | `assign` / `raise` / `sendTo` / `sendParent` / `forwardTo` / `emit` / `cancel` / `stopChild` / `stop` / `spawnChild` / `log` / `enqueueActions` as a discarded statement (also `void` / `await`ed), or returned by a concise arrow in `entry` / `exit` / `actions` or `setup({ actions })` | creators imported from `xstate`, destructured from or called on a `setup()` result                                                                                                                                                                                                                                                         |
| `no-context-mutation`          | assignment, `++` / `--`, `delete`, or a mutating method on a path rooted at `context` or `snapshot.context` / `getSnapshot().context`                                                                                                                                                      | `context` destructured by an implementation function inside `setup` / `createMachine` / `createStateConfig` / `createAction` / `assign` / `enqueueActions`. Methods: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`, `set`, `add`, `delete`, `clear`. ⏭️ Map/Set with `allowCollectionMethods: true` |
| `no-machine-in-render`         | `createMachine`, `<setup>.createMachine`, `createActor`, `interpret` directly in a component or hook body                                                                                                                                                                                  | nearest enclosing function is a component (`/^[A-Z]/`) or hook (`/^use[A-Z]/`), `memo` / `forwardRef` included, in a file importing `react` or `@xstate/react`. ⏭️ nested callbacks (`useMemo`, `useEffect`, handlers), `machine.provide(...)`                                                                                             |
| `named-actor-src`              | `invoke.src` or first argument of `spawnChild` / `enqueue.spawnChild` that is a call, a function, or an identifier not bound to a string constant                                                                                                                                          | `invoke.src` in `createMachine` / `<setup>.createMachine` / `<setup>.createStateConfig` config. ⏭️ member expressions                                                                                                                                                                                                                      |
| `stable-selector-result`       | inline `useSelector` selector returning a fresh object/array, no comparator argument                                                                                                                                                                                                       | `useSelector` from `@xstate/react`, `@xstate/store-react`, legacy `@xstate/store/react`, `<ActorContext>.useSelector`. Fresh = object/array literal, `.map` / `.filter` / `.flatMap` / `.toSorted`, `Object.keys` / `values` / `entries`                                                                                                   |
| `require-setup-create-machine` | machine not built via `setup().createMachine()`, or `setup()` with no argument, `{}`, or an object literal without `types`                                                                                                                                                                 | named and namespace imports, aliases, lexical shadows. ⏭️ `setup(...)` arguments not statically readable (identifiers, spreads)                                                                                                                                                                                                            |
| `require-event-satisfies`      | an object-literal event sent without `satisfies`                                                                                                                                                                                                                                           | `send`, `raise`, `sendTo`, `sendParent`, `emit` from `xstate`; `enqueue.raise` / `sendTo` / `sendParent` / `emit` on `enqueueActions`' `enqueue`; `.send` on refs from `createActor`, `useActorRef`, `<ActorContext>.useActorRef()`, and the `useMachine` / `useActor` tuple (`send` and actor-ref slots). ⏭️ unrelated `.send` methods    |
| `machine-naming`               | a present static machine id failing `pattern`                                                                                                                                                                                                                                              | ⏭️ absent ids; `createStateConfig` (state-node ids, not machine ids)                                                                                                                                                                                                                                                                       |
| `no-unreachable-transition`    | an unguarded branch not last in `always`, `on.<EVENT>`, `after.<DELAY>`, `onDone`, `onError` arrays (later branches dead); an unguarded `always` with no `target` or targeting its own state (infinite loop)                                                                               | ⏭️ branches with spreads or computed keys                                                                                                                                                                                                                                                                                                  |
| `prefer-send-to`               | `sendParent` imported from `xstate`, and `<object>.sendParent(...)` such as `enqueue.sendParent`                                                                                                                                                                                           |                                                                                                                                                                                                                                                                                                                                            |
| `promise-actor-abort-signal`   | inline `fromPromise` logic calling global `fetch` for a read (no init, or literal `GET` / `HEAD`) never referencing `signal`                                                                                                                                                               | ⏭️ wrapped HTTP clients are invisible to it                                                                                                                                                                                                                                                                                                |

Config-walking rules treat the argument of `<setup>.createStateConfig(...)` as machine config.

**Not shipped: `no-deprecated-xstate-api`.** Type-aware `typescript/no-deprecated` already reports `interpret`, `stop`, `getNextSnapshot` and the other `@deprecated` exports.

</details>

**Credit:** `no-imperative-action-creator` and `no-unreachable-transition` re-implement `eslint-plugin-xstate`'s `no-imperative-action` and `no-infinite-loop` ideas (Richard Laffers); no code copied.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                     | Trigger or review scope                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `machine-naming`               | Require XState machine ids to follow the configured naming convention.                                                                                            |
| `named-actor-src`              | Require invoke.src and spawnChild() to reference actors declared in setup({ actors }) by string key instead of inline actor logic.                                |
| `no-context-mutation`          | Forbid in-place mutation of XState context (assignments, delete, and mutating array/Map/Set methods on context or snapshot.context).                              |
| `no-imperative-action-creator` | Forbid XState action creators (assign, raise, sendTo, ...) called as discarded statements or returned from inline action functions, where they are silent no-ops. |
| `no-machine-in-render`         | Forbid createMachine, setup().createMachine, createActor and interpret calls directly in a React component or hook body.                                          |
| `no-unreachable-transition`    | Forbid an unguarded transition placed before other branches of the same transition array, and unguarded always transitions that never leave their state.          |
| `prefer-send-to`               | Prefer sendTo() with an actor ref passed through input over sendParent() and enqueue.sendParent().                                                                |
| `promise-actor-abort-signal`   | Require inline fromPromise actors that call fetch for a read to forward the actor's abort signal.                                                                 |
| `require-event-satisfies`      | Require object-literal events sent to machines to be checked with satisfies.                                                                                      |
| `require-setup-create-machine` | Require XState machines to be defined via setup().createMachine() with types declared in setup({ types }).                                                        |
| `stable-selector-result`       | Forbid inline useSelector selectors that return a fresh object or array when no comparator argument is passed.                                                    |

### Credited concepts

- ai-automation by Sandro Maglione (inspiration, independently re-implemented)
- eslint-plugin-xstate no-imperative-action by Richard Laffers (concept)
- eslint-plugin-xstate no-infinite-loop by Richard Laffers (concept)

<!-- harness-catalog:end -->
