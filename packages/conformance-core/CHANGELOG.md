# @aurelienbbn/conformance-core

## 0.3.0

### Minor Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Make four core checks fit more repositories.

  - `duplication-budget` scans code formats only (`typescript`, `tsx`, `javascript`, `jsx`) and ignores test files by default. Prose, YAML, JSON and markup clones were 3-98% of the budget-0 count on six corpus repos, and test-to-test clones 79-87% of the code clones on two of them. New options `duplication.formats`, `duplication.includeTests` restore the old scope.
  - `duplication.timeoutMs` raises the fixed 120 s tool timeout for large monorepos; the timeout finding names the option.
  - `tsconfig-strictness` no longer requires `verbatimModuleSyntax` of a config whose resolved `module` is `commonjs`, `amd`, `umd` or `system`, where TypeScript rejects ESM syntax with it on.
  - `instruction-blocks` ignores block markers quoted in prose or code fences, so an `AGENTS.md` that documents the marker syntax no longer fails with "repeats the block markers".

  `tsconfig-strictness` runs its default baseline when `tsconfigStrictness` is not set (previously skipped unless `{}` or options were passed). A strict-family flag turned off, or a baseline flag missing, now fails projects that never opted in; a project with no tsconfig reports the check as unsupported. Turn it off with `skipChecks: ["tsconfig-strictness"]`, or waive single flags with `tsconfigStrictness.waivers`.

  Remove the `dead-exports` check with its `deadExports` run option and the `deadExports` and `DeadExportsOptions` exports: run Knip directly.

  New default-on check `undeclared-dependencies`: a runtime source file importing a package its own `package.json` does not declare (it resolves only because the root or a sibling member declares it) is an error; tests, tool configs, setup files and member-level `scripts/`/`tools/` may also rely on any ancestor manifest naming the manifest and the packages to add. It reads imports itself, so it needs no external tool; `@types/<name>` counts as a declaration, and `ignorePackages` / `excludePaths` handle aliases and generated sources. Turn it off with `skipChecks: ["undeclared-dependencies"]`. The registry now holds seven checks, and `coreConformance` registers one more test.

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Remove the duplicate Knip wrapper; run Knip directly for unused files, exports and dependencies. Add advisory snapshot ancestry, migration SQL, retention metadata, calendar schema, destructive reason and fenced JSDoc checks. Publish Windows-compatible commit-message attribution hooks. Keep statement spacing in post-oxfmt formatting.

## 0.2.0

### Minor Changes

- [#78](https://github.com/aurelienbobenrieth/harness/pull/78) [`c18bf45`](https://github.com/aurelienbobenrieth/harness/commit/c18bf45bba83f79a7b2683cf5353ad689203d0fd) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Add `instruction-blocks`: marked blocks in `AGENTS.md` (or another instructions file) must match their source file exactly, so always-on agent rules are loaded every turn and still written once. Opt in with `instructionBlocks: { blocks: { <name>: "<source path>" } }`; unset, the check is skipped.

## 0.1.2

### Patch Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.88.0, `oxc-parser` 0.154.0, `postcss` 8.5.30 and `smol-toml` 1.9.1. Accept agentlint 0.8 alongside the existing supported engine versions (`>=0.3.0 <0.9.0`). Keep baseline tools pinned and exercise the current consumer profile with agentlint 0.8.0, oxlint 1.88.0, oxlint-tsgolint 7.0.2004, Vitest 5.0.4 and Stylelint 17.16.0.

## 0.1.1

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 5 repo-hygiene checks for any TypeScript repo. Plain functions or one Vitest file.
