# @aurelienbbn/oxlint-plugin-alchemy

## 0.1.3

### Patch Changes

- [#97](https://github.com/aurelienbobenrieth/harness/pull/97) [`754d98c`](https://github.com/aurelienbobenrieth/harness/commit/754d98c10480b77c654c88a412636d7ba80cffea) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Accept agentlint 0.9 (`>=0.3.0 <0.10.0`) and oxfmt 0.78 (`>=0.67.0 <0.69.0 || ^0.74.0 || ^0.78.0`) as peers. Update runtime dependencies to `@oxlint/plugins` 1.93.0, `graphql` 17.1.0 and `parse5` 8.1.1. The current consumer profile is verified with agentlint 0.9.1, oxlint 1.93.0, oxlint-tsgolint 7.0.2006, oxfmt 0.78.0, Vite Plus 1.5.1 and Vitest 5.1.0.

## 0.1.2

### Patch Changes

- [#95](https://github.com/aurelienbobenrieth/harness/pull/95) [`c90c05c`](https://github.com/aurelienbobenrieth/harness/commit/c90c05c647072e0f3276d951635499cfcda4976a) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.91.0, `oxc-parser` 0.157.0 and `postcss` 8.5.32.

## 0.1.1

### Patch Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.88.0, `oxc-parser` 0.154.0, `postcss` 8.5.30 and `smol-toml` 1.9.1. Accept agentlint 0.8 alongside the existing supported engine versions (`>=0.3.0 <0.9.0`). Keep baseline tools pinned and exercise the current consumer profile with agentlint 0.8.0, oxlint 1.88.0, oxlint-tsgolint 7.0.2004, Vitest 5.0.4 and Stylelint 17.16.0.

## 0.1.0

### Minor Changes

- [#26](https://github.com/aurelienbobenrieth/harness/pull/26) [`db5fab9`](https://github.com/aurelienbobenrieth/harness/commit/db5fab945668b30d43d420ff14773fc884c1c448) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 4 oxlint rules for Alchemy v2 runtimes: Config read only at runtime, instance-scope finalizers that never run on workerd, plaintext secrets in Worker env, Workflow I/O outside task.
