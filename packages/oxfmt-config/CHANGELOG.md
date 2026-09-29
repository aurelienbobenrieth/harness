# @aurelienbbn/oxfmt-config

## 0.2.0

### Minor Changes

- [#32](https://github.com/aurelienbobenrieth/harness/pull/32) [`9bd7af2`](https://github.com/aurelienbobenrieth/harness/commit/9bd7af247d7ef03a1f1c3f80befe14123545a1d1) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `printWidth` drops from 120 to 100, oxfmt's own default and the width executor and t3code format at. Re-run `vp fmt` after upgrading; pass `printWidth: 120` to `defineOxfmtConfig` to keep the old width.

## 0.1.1

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. One oxfmt config for every JS/TS repo: 120 columns, double quotes, trailing commas, multiline JSDoc, sorted `package.json`.
