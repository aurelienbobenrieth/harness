# @aurelienbbn/oxlint-plugin-core

## 0.5.1

### Patch Changes

- [#95](https://github.com/aurelienbobenrieth/harness/pull/95) [`c90c05c`](https://github.com/aurelienbobenrieth/harness/commit/c90c05c647072e0f3276d951635499cfcda4976a) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.91.0, `oxc-parser` 0.157.0 and `postcss` 8.5.32.

## 0.5.0

### Minor Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Remove the duplicate Knip wrapper; run Knip directly for unused files, exports and dependencies. Add advisory snapshot ancestry, migration SQL, retention metadata, calendar schema, destructive reason and fenced JSDoc checks. Publish Windows-compatible commit-message attribution hooks. Keep statement spacing in post-oxfmt formatting.

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Precision fixes found by linting 25 projects.

  - Removes `core/padding-before-exit` (deprecated since `padding-line-between-statements`; drop it from configs that name it) and `core/no-stubbed-subject` (no hits across 25 projects).
  - `no-multi-positional-parameters` accepts externally imposed signatures only: callbacks and objects handed to an imported-from-a-package or builtin callee, bindings, `satisfies` and `as` typed by a package or global type, `override` methods of a package or global class, and default-exported objects. Callees, types and base classes declared in the project, and overload implementations, are reported.
  - `no-let` gains `allowForLoopHeaders` and `allowBranchInitialization` (both default `false`).
  - `workspace-boundaries` skips the relative-path and unexported-subpath checks in test files.
  - `no-mutable-exported-state` accepts `readonly T[]`, `readonly [..]`, `Readonly<..>`, `ReadonlyArray`, `ReadonlyMap` and `ReadonlySet` annotations.
  - `workspace-boundaries` no longer judges subpath imports of a member whose manifest has no `exports` field.
  - `no-test-sleeps` allows zero-delay yields (`setTimeout(resolve, 0)`, `sleep(0)`).
  - `no-vitest-in-source` and `no-test-logic-in-production` also treat `*.test-d.*`, `test-setup`/`test-support`/`test-helpers` files, and `test`, `tests`, `__tests__`, `__mocks__`, `e2e` folders as test code; `*.test-d.*` counts as a test file for the test rules.
  - `no-reexport-only-modules` allows every `index.*` and `mod.ts` entrypoint by default.
  - `no-error-message-matching` ignores emptiness checks (`error.message !== ""`).
  - `no-exported-anonymous-object-return` accepts `Named & { extra }` return types.
  - Adds `require-fetch-abort-signal`: every global `fetch` (also `window`/`globalThis`/`self`/`global`) must carry a signal (an init `{ signal }`, a parameter init forwarded whole, or a `new Request(url, { signal })`); test files and `Effect.tryPromise` / `Effect.promise` thunks (owned by `effect/require-abort-signal`) are skipped. Replaces `shopify-app/require-fetch-abort-signal`.
  - `workspace-boundaries` gains `includeTestFiles` (judge relative and unexported-subpath reaches in test files too, default `false`) and `missingExports: "root"` (a member whose manifest has no `exports` field opens only its root, default `"open"`), so a project can drop a local copy of the rule and keep its stricter verdicts.

  Allow empty error-message presence checks used to choose display fallbacks.

  Add harness-format-padding: run only the statement-spacing autofix as part of formatting. Remove both padding rules from reported steering findings; consumers should disable them in lint and run harness-format-padding after oxfmt.

## 0.4.1

### Patch Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.88.0, `oxc-parser` 0.154.0, `postcss` 8.5.30 and `smol-toml` 1.9.1. Accept agentlint 0.8 alongside the existing supported engine versions (`>=0.3.0 <0.9.0`). Keep baseline tools pinned and exercise the current consumer profile with agentlint 0.8.0, oxlint 1.88.0, oxlint-tsgolint 7.0.2004, Vitest 5.0.4 and Stylelint 17.16.0.

## 0.4.0

### Minor Changes

- [#62](https://github.com/aurelienbobenrieth/harness/pull/62) [`cb0dcdc`](https://github.com/aurelienbobenrieth/harness/commit/cb0dcdc3f08e9926bacab796a14531dcf8bb05fa) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Adds `core/workspace-boundaries`: reads the members of the nearest `pnpm-workspace.yaml` (or `package.json` `workspaces`) and reports an import, re-export, or `import()` between members when a package imports an app, a member reaches another by relative path, or the subpath is not opened by the target's `exports`. `apps` sets which member directories are deployables (default `["apps/**"]`); `forbidden` lists member directory pairs that never import each other, such as vertical packages or a kernel and its adapters. Off until enabled.

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
