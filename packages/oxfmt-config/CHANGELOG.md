# @aurelienbbn/oxfmt-config

## 0.2.2

### Patch Changes

- [#97](https://github.com/aurelienbobenrieth/harness/pull/97) [`754d98c`](https://github.com/aurelienbobenrieth/harness/commit/754d98c10480b77c654c88a412636d7ba80cffea) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Accept agentlint 0.9 (`>=0.3.0 <0.10.0`) and oxfmt 0.78 (`>=0.67.0 <0.69.0 || ^0.74.0 || ^0.78.0`) as peers. Update runtime dependencies to `@oxlint/plugins` 1.93.0, `graphql` 17.1.0 and `parse5` 8.1.1. The current consumer profile is verified with agentlint 0.9.1, oxlint 1.93.0, oxlint-tsgolint 7.0.2006, oxfmt 0.78.0, Vite Plus 1.5.1 and Vitest 5.1.0.

## 0.2.1

### Patch Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Support oxfmt 0.74 alongside the existing 0.67 and 0.68 releases. Consumers can update to oxfmt 0.74 without changing their formatter configuration.

## 0.2.0

### Minor Changes

- [#32](https://github.com/aurelienbobenrieth/harness/pull/32) [`9bd7af2`](https://github.com/aurelienbobenrieth/harness/commit/9bd7af247d7ef03a1f1c3f80befe14123545a1d1) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `printWidth` drops from 120 to 100, oxfmt's own default and the width executor and t3code format at. Re-run `vp fmt` after upgrading; pass `printWidth: 120` to `defineOxfmtConfig` to keep the old width.

## 0.1.1

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. One oxfmt config for every JS/TS repo: 120 columns, double quotes, trailing commas, multiline JSDoc, sorted `package.json`.
