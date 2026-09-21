# @aurelienbbn/oxlint-plugin-xstate

Custom oxlint rules for XState v5 machines and actors. `eslint-plugin-xstate` does not analyse `setup().createMachine()` machines (it matches a bare `createMachine` callee; last published 2023-12 with an ESLint 8 peer), so this plugin carries its own setup-aware checks.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

The plugin ships no preset: every rule is registered independently and enabled by name. Rules marked MAYBE are lower-confidence or opinionated; keep them off or at `warn` unless the house config wants them.

| Rule                                 | Trigger                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-imperative-action-creator`       | `assign`/`raise`/`sendTo`/`sendParent`/`forwardTo`/`emit`/`cancel`/`stopChild`/`stop`/`spawnChild`/`log`/`enqueueActions` (imported from `xstate`, destructured from or called on a `setup()` result) used as a discarded statement, or returned by a concise arrow sitting in `entry`/`exit`/`actions` or `setup({ actions })`. The call only builds an action object, so nothing happens.                                                                                     |
| `no-context-mutation`                | Assignment, `++`/`--`, `delete`, or a mutating method (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`, and `set`/`add`/`delete`/`clear`) on a path rooted at the `context` destructured by an implementation function inside `setup`/`createMachine`/`createStateConfig`/`createAction`/`assign`/`enqueueActions`, or at `snapshot.context` / `getSnapshot().context`. Option `allowCollectionMethods: true` exempts the Map/Set methods. |
| `no-machine-in-render`               | `createMachine`, `<setup>.createMachine`, `createActor` or `interpret` whose nearest enclosing function is a component (`/^[A-Z]/`) or hook (`/^use[A-Z]/`), including `memo`/`forwardRef` wrappers, in a file importing `react` or `@xstate/react`. Nested callbacks (`useMemo`, `useEffect`, handlers) and `machine.provide(...)` are not reported.                                                                                                                           |
| `named-actor-src`                    | `invoke.src` inside `createMachine`/`<setup>.createMachine`/`<setup>.createStateConfig` config, or the first argument of `spawnChild` / `enqueue.spawnChild`, that is a call, a function, or an identifier not bound to a string constant. Member expressions are skipped. Options: `checkSpawn: true` also checks `spawn(...)` taken from an `assign` argument; `guards: true` also reports inline function `guard` values.                                                    |
| `stable-selector-result`             | Inline `useSelector` selector (from `@xstate/react`, `@xstate/store-react`, or the legacy `@xstate/store/react`; also `<ActorContext>.useSelector`) returning an object literal, array literal, `.map`/`.filter`/`.flatMap`/`.toSorted` call or `Object.keys`/`values`/`entries` with no comparator argument.                                                                                                                                                                   |
| `no-unreachable-transition` (MAYBE)  | An unguarded branch that is not last in an `always`, `on.<EVENT>`, `after.<DELAY>`, `onDone` or `onError` array (later branches are dead), and the sub-case of an unguarded `always` transition with no `target` or targeting its own state (infinite loop). Branches with spreads or computed keys are skipped.                                                                                                                                                                |
| `prefer-send-to` (MAYBE, use `warn`) | `sendParent` imported from `xstate` and `<object>.sendParent(...)` calls such as `enqueue.sendParent`.                                                                                                                                                                                                                                                                                                                                                                          |
| `promise-actor-abort-signal` (MAYBE) | Inline `fromPromise` logic calling the global `fetch` for a read (no init, or a literal `GET`/`HEAD` method) while never referencing `signal`. Wrapped HTTP clients are invisible to it.                                                                                                                                                                                                                                                                                        |

`require-setup-create-machine` also reports `setup()` called with no argument, with `{}`, or with an object literal that has no `types` key; arguments that cannot be read statically (identifiers, spreads) are skipped.

`require-event-satisfies` covers `send`, `raise`, `sendTo`, `sendParent` and `emit` imported from `xstate`, `enqueue.raise`/`sendTo`/`sendParent`/`emit` on the `enqueue` parameter of `enqueueActions`, and `.send` on actor refs from `createActor`, `useActorRef`, `<ActorContext>.useActorRef()`, and the `useMachine`/`useActor` tuple (its `send` slot and its actor-ref slot). For machines typed through `setup({ types })`, TypeScript already checks those payloads against the event union; the rule earns its keep where the event type is erased: `sendTo`/`sendParent` targets, `AnyActorRef`, and refs passed through untyped boundaries. Narrow `sendCalleeNames` to those senders if the rule reads as redundant in a fully typed codebase.

Config-walking rules treat the argument of `<setup>.createStateConfig(...)` as machine config. `machine-naming` is unchanged: state configs carry state-node ids, not machine ids.

Not shipped: `no-deprecated-xstate-api`. Type-aware `typescript/no-deprecated` already reports `interpret`, `stop`, `getNextSnapshot` and the other `@deprecated` exports.

Concept credits for rules outside the generated block: `no-imperative-action-creator` and `no-unreachable-transition` re-implement ideas from `eslint-plugin-xstate` (`no-imperative-action`, `no-infinite-loop`) by Richard Laffers; no code was copied.

## Contract boundaries and migration

Machine IDs default to a generic dotted kebab-case namespace instead of oio; absent IDs remain permitted, and configured patterns validate present static IDs. Event-satisfies checks recognize imported XState send helpers and createActor-owned sends; unrelated .send methods are ignored. Satisfies unknown/any is not accepted as evidence. The rule enforces an explicit syntax policy, not a proof of the intended event union. setup/createMachine enforcement resolves named and namespace imports, aliases, and lexical shadows.

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
