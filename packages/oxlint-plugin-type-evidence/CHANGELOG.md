# @aurelienbbn/oxlint-plugin-type-evidence

## 0.1.6

### Patch Changes

- [#99](https://github.com/aurelienbobenrieth/harness/pull/99) [`d46650d`](https://github.com/aurelienbobenrieth/harness/commit/d46650d2662b4a849cb8530218640c09e2c8c0a4) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Rewrite the README: claim headings in the promised order (install and first command before reference), install commands where they were missing, and rule and preset counts corrected against the registered exports.

## 0.1.5

### Patch Changes

- [#97](https://github.com/aurelienbobenrieth/harness/pull/97) [`754d98c`](https://github.com/aurelienbobenrieth/harness/commit/754d98c10480b77c654c88a412636d7ba80cffea) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Accept agentlint 0.9 (`>=0.3.0 <0.10.0`) and oxfmt 0.78 (`>=0.67.0 <0.69.0 || ^0.74.0 || ^0.78.0`) as peers. Update runtime dependencies to `@oxlint/plugins` 1.93.0, `graphql` 17.1.0 and `parse5` 8.1.1. The current consumer profile is verified with agentlint 0.9.1, oxlint 1.93.0, oxlint-tsgolint 7.0.2006, oxfmt 0.78.0, Vite Plus 1.5.1 and Vitest 5.1.0.

## 0.1.4

### Patch Changes

- [#95](https://github.com/aurelienbobenrieth/harness/pull/95) [`c90c05c`](https://github.com/aurelienbobenrieth/harness/commit/c90c05c647072e0f3276d951635499cfcda4976a) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.91.0, `oxc-parser` 0.157.0 and `postcss` 8.5.32.

## 0.1.3

### Patch Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - All ten rules skip test files (`*.test.*`, `*.spec.*`, `__tests__`, `__mocks__`, `test(s)/`, `e2e/`), where assertion-built doubles and deliberately invalid inputs are the subject. `no-widen-then-assert` no longer reports `return out as T` when `T` is the enclosing function's type parameter.

## 0.1.2

### Patch Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.88.0, `oxc-parser` 0.154.0, `postcss` 8.5.30 and `smol-toml` 1.9.1. Accept agentlint 0.8 alongside the existing supported engine versions (`>=0.3.0 <0.9.0`). Keep baseline tools pinned and exercise the current consumer profile with agentlint 0.8.0, oxlint 1.88.0, oxlint-tsgolint 7.0.2004, Vitest 5.0.4 and Stylelint 17.16.0.

## 0.1.1

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 10 oxlint rules that stop TypeScript from losing what it knows: no laundering casts, no `unknown` leaking past boundaries, no widening a value you just wrote.
