# @aurelienbbn/conformance-alchemy

## 0.2.0

### Minor Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `alchemy-state-gitignored` finds stack files by content when `stackFiles` is unset: every `alchemy.run.ts` (fast path) plus any other source file that imports `alchemy` and calls its stack factory (`Alchemy.Stack(...)`, `Stack.make(...)`, `alchemy("app")`), so a stack in `infra/stack.ts` is checked instead of failing with "no stack file". Test, declaration, `dist` and `node_modules` files are skipped. An explicit `stackFiles` still wins. A project whose `.alchemy/` is not ignored next to such a file now reports an error it did not before.

## 0.1.1

### Patch Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.88.0, `oxc-parser` 0.154.0, `postcss` 8.5.30 and `smol-toml` 1.9.1. Accept agentlint 0.8 alongside the existing supported engine versions (`>=0.3.0 <0.9.0`). Keep baseline tools pinned and exercise the current consumer profile with agentlint 0.8.0, oxlint 1.88.0, oxlint-tsgolint 7.0.2004, Vitest 5.0.4 and Stylelint 17.16.0.

## 0.1.0

### Minor Changes

- [#26](https://github.com/aurelienbobenrieth/harness/pull/26) [`db5fab9`](https://github.com/aurelienbobenrieth/harness/commit/db5fab945668b30d43d420ff14773fc884c1c448) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 4 conformance checks for Alchemy v2 projects: gitignored local state, remote state in CI, PR preview cleanup, exact Alchemy pin.
