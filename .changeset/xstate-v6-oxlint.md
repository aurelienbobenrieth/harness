---
"@aurelienbbn/oxlint-plugin-xstate": minor
---

Support XState v6 alpha and `@xstate/effect` alpha beside v5 (checked against `xstate@6.0.0-alpha.64`, `@xstate/effect@0.1.0-alpha.6`, `@xstate/react@7.0.0-alpha.4`).

- New rules: `require-effect-actor`, `no-discarded-effect`, `no-deferred-enqueue`, `no-direct-named-action`, `valid-duration`, `no-persist-live-snapshot`.
- The existing rules recognize v6 spellings: `enq` handlers, `schemas`, `setupEffect`, `createSystem().setup`, `createAsyncLogic`, `createInvoke`, `createStateConfig(path, config)`, `actor.select`, and `@xstate/effect` `send` and `createEffectActor`.
- `no-imperative-action-creator` and `prefer-send-to` are deprecated: v6 removes the action creators and `sendParent`. Both still work on v5.
- Narrower v5 reports:
  - `require-setup-create-machine` accepts a bare `createMachine` that declares `types` or `schemas`.
  - `no-unreachable-transition` no longer reports `always: {}`, `{ description }` or an own-state target, which settle at runtime.
  - `named-actor-src` checks `invoke.src` only in v5-shaped files.
