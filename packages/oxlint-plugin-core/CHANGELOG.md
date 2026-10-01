# @aurelienbbn/oxlint-plugin-core

## 0.3.0

### Minor Changes

- [#49](https://github.com/aurelienbobenrieth/harness/pull/49) [`4f758c5`](https://github.com/aurelienbobenrieth/harness/commit/4f758c5da4e618239a276ce7f0d2060eee5fa358) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Adds `core/padding-line-between-statements`: ESLint's rule of the same name (its `{ blankLine, prev, next }` options and statement types, autofixed), except that a comment block above a statement belongs to it, so the blank line goes above the comments. Enabled without options, it pads around blocks and multiline expressions, after a run of `const`/`let` declarations, and before `return` and `throw`. `core/padding-before-exit` is deprecated: that default covers it, and `{ blankLine: "always", prev: "*", next: ["return", "throw"] }` alone reproduces it. Turn it off when you enable the new rule; it still works until a later minor removes it.

## 0.2.0

### Minor Changes

- [#18](https://github.com/aurelienbobenrieth/harness/pull/18) [`c0e24ff`](https://github.com/aurelienbobenrieth/harness/commit/c0e24ff1b3b1a5b4dcd81056ff37e4ba6eaf68c8) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Add `padding-before-exit`, which requires a blank line above a `return` or `throw` that follows another statement in the same list and inserts it with an autofix.

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 15 oxlint rules for any TypeScript codebase: swallowed errors, flaky or hollow tests, test code in production, anonymous public contracts.
