# @aurelienbbn/agentlint-plugin-xstate

## 0.2.2

### Patch Changes

- [#97](https://github.com/aurelienbobenrieth/harness/pull/97) [`754d98c`](https://github.com/aurelienbobenrieth/harness/commit/754d98c10480b77c654c88a412636d7ba80cffea) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Accept agentlint 0.9 (`>=0.3.0 <0.10.0`) and oxfmt 0.78 (`>=0.67.0 <0.69.0 || ^0.74.0 || ^0.78.0`) as peers. Update runtime dependencies to `@oxlint/plugins` 1.93.0, `graphql` 17.1.0 and `parse5` 8.1.1. The current consumer profile is verified with agentlint 0.9.1, oxlint 1.93.0, oxlint-tsgolint 7.0.2006, oxfmt 0.78.0, Vite Plus 1.5.1 and Vitest 5.1.0.

## 0.2.1

### Patch Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `xstate/actor-cleanup` stays silent when the file already stops the stored actor (`actor.stop()`, `this.#actor?.stop()`, or a field copied from the creation binding). All 7 findings on one application were accepted with exactly that reason; the rule now reports only creations with no `stop()` on their binding.

## 0.2.0

### Minor Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Support XState v6 alpha and `@xstate/effect` alpha beside v5, and add the `spawn-id-collision` and `effect-actor-observed` reviews to `xstatePreset`.

  All five existing rules raise their standard revision, so earlier acceptances need a fresh review. Their guidance now states per version what differs, and corrects claims that were false:

  - an incompatible snapshot gives an actor in status `'error'`; it doesn't throw;
  - in v6, `onError` recovers action and spawned-child errors.

  Detection adds `enq.spawn`, context-factory `spawn`, `createInvoke`, the v6 logic creators, `fromEffect*`, `system.createActor`, `createEffectActor`, `createActorAtoms`, v6 context patches, and `schemas.context`.

### Patch Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.88.0, `oxc-parser` 0.154.0, `postcss` 8.5.30 and `smol-toml` 1.9.1. Accept agentlint 0.8 alongside the existing supported engine versions (`>=0.3.0 <0.9.0`). Keep baseline tools pinned and exercise the current consumer profile with agentlint 0.8.0, oxlint 1.88.0, oxlint-tsgolint 7.0.2004, Vitest 5.0.4 and Stylelint 17.16.0.

## 0.1.4

### Patch Changes

- [#67](https://github.com/aurelienbobenrieth/harness/pull/67) [`b8a59d5`](https://github.com/aurelienbobenrieth/harness/commit/b8a59d5f28c0f63cbbf8afddd928977489a40613) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Extend the declared agentlint peer range to >=0.3.0 <0.8.0 and exercise the published 0.7.0 engine in the current packed-consumer compatibility profile. Keep development and the baseline consumer on 0.3.0.

## 0.1.3

### Patch Changes

- [#45](https://github.com/aurelienbobenrieth/harness/pull/45) [`d88074c`](https://github.com/aurelienbobenrieth/harness/commit/d88074c85ff18543527be6d1fd7d798c4b26b7fb) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - docs: the README states the agentlint peer range the package declares, `>=0.3.0 <0.5.0`.

## 0.1.2

### Patch Changes

- [#41](https://github.com/aurelienbobenrieth/harness/pull/41) [`d073fdc`](https://github.com/aurelienbobenrieth/harness/commit/d073fdc61bc9cfc9d0cbded23286fa82af00f685) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - The agentlint plugins accept `@aurelienbbn/agentlint` 0.4 as a peer (`>=0.3.0 <0.5.0`), whose TSX grammar parses a `&` inside a JSX string attribute such as Tailwind's `className="[&_svg]:size-4"`. The compatibility `current` profile now tests agentlint 0.4.0.

## 0.1.1

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 5 agentlint reviews for XState v5: every actor has an owner, every failure a path, every persisted snapshot a version.
