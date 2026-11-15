# @aurelienbbn/oxlint-plugin-xstate

## 0.3.3

### Patch Changes

- [#99](https://github.com/aurelienbobenrieth/harness/pull/99) [`d46650d`](https://github.com/aurelienbobenrieth/harness/commit/d46650d2662b4a849cb8530218640c09e2c8c0a4) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Rewrite the README: claim headings in the promised order (install and first command before reference), install commands where they were missing, and rule and preset counts corrected against the registered exports.

## 0.3.2

### Patch Changes

- [#97](https://github.com/aurelienbobenrieth/harness/pull/97) [`754d98c`](https://github.com/aurelienbobenrieth/harness/commit/754d98c10480b77c654c88a412636d7ba80cffea) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Accept agentlint 0.9 (`>=0.3.0 <0.10.0`) and oxfmt 0.78 (`>=0.67.0 <0.69.0 || ^0.74.0 || ^0.78.0`) as peers. Update runtime dependencies to `@oxlint/plugins` 1.93.0, `graphql` 17.1.0 and `parse5` 8.1.1. The current consumer profile is verified with agentlint 0.9.1, oxlint 1.93.0, oxlint-tsgolint 7.0.2006, oxfmt 0.78.0, Vite Plus 1.5.1 and Vitest 5.1.0.

## 0.3.1

### Patch Changes

- [#95](https://github.com/aurelienbobenrieth/harness/pull/95) [`c90c05c`](https://github.com/aurelienbobenrieth/harness/commit/c90c05c647072e0f3276d951635499cfcda4976a) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.91.0, `oxc-parser` 0.157.0 and `postcss` 8.5.32.

## 0.3.0

### Minor Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `xstate/machine-naming` has no default naming convention: it requires an explicitly configured `pattern`, and without one reports once per file that defines a machine. `xstate/require-event-satisfies` no longer lists bare `send` in the default `sendCalleeNames` (still opt-in); binding-proven senders such as `actorRef.send` are unchanged without options. `xstate/valid-duration` rejects every duration string (`"PT5S"`, `"5s"`) in XState v5 files, where delays are numbers or declared names. `xstate/no-persist-live-snapshot` skips test files.

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
