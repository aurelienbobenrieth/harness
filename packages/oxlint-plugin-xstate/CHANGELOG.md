# @aurelienbbn/oxlint-plugin-xstate

## 0.2.0

### Minor Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Support XState v6 alpha and `@xstate/effect` alpha beside v5 (checked against `xstate@6.0.0-alpha.64`, `@xstate/effect@0.1.0-alpha.6`, `@xstate/react@7.0.0-alpha.4`).

  - New rules: `require-effect-actor`, `no-discarded-effect`, `no-deferred-enqueue`, `no-direct-named-action`, `valid-duration`, `no-persist-live-snapshot`.
  - The existing rules recognize v6 spellings: `enq` handlers, `schemas`, `setupEffect`, `createSystem().setup`, `createAsyncLogic`, `createInvoke`, `createStateConfig(path, config)`, `actor.select`, and `@xstate/effect` `send` and `createEffectActor`.
  - `no-imperative-action-creator` and `prefer-send-to` are deprecated: v6 removes the action creators and `sendParent`. Both still work on v5.
  - Narrower v5 reports:
    - `require-setup-create-machine` accepts a bare `createMachine` that declares `types` or `schemas`.
    - `no-unreachable-transition` no longer reports `always: {}`, `{ description }` or an own-state target, which settle at runtime.
    - `named-actor-src` checks `invoke.src` only in v5-shaped files.

### Patch Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.88.0, `oxc-parser` 0.154.0, `postcss` 8.5.30 and `smol-toml` 1.9.1. Accept agentlint 0.8 alongside the existing supported engine versions (`>=0.3.0 <0.9.0`). Keep baseline tools pinned and exercise the current consumer profile with agentlint 0.8.0, oxlint 1.88.0, oxlint-tsgolint 7.0.2004, Vitest 5.0.4 and Stylelint 17.16.0.

## 0.1.1

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 11 oxlint rules for XState v5 machines built with `setup().createMachine()`, the shape `eslint-plugin-xstate` can't see.
