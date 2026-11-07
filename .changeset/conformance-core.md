---
"@aurelienbbn/conformance-core": minor
---

Make four core checks fit more repositories.

- `duplication-budget` scans code formats only (`typescript`, `tsx`, `javascript`, `jsx`) and ignores test files by default. Prose, YAML, JSON and markup clones were 3-98% of the budget-0 count on six corpus repos, and test-to-test clones 79-87% of the code clones on two of them. New options `duplication.formats`, `duplication.includeTests` restore the old scope.
- `duplication.timeoutMs` raises the fixed 120 s tool timeout for large monorepos; the timeout finding names the option.
- `tsconfig-strictness` no longer requires `verbatimModuleSyntax` of a config whose resolved `module` is `commonjs`, `amd`, `umd` or `system`, where TypeScript rejects ESM syntax with it on.
- `instruction-blocks` ignores block markers quoted in prose or code fences, so an `AGENTS.md` that documents the marker syntax no longer fails with "repeats the block markers".

`tsconfig-strictness` runs its default baseline when `tsconfigStrictness` is not set (previously skipped unless `{}` or options were passed). A strict-family flag turned off, or a baseline flag missing, now fails projects that never opted in; a project with no tsconfig reports the check as unsupported. Turn it off with `skipChecks: ["tsconfig-strictness"]`, or waive single flags with `tsconfigStrictness.waivers`.

Remove the `dead-exports` check with its `deadExports` run option and the `deadExports` and `DeadExportsOptions` exports: run Knip directly.

New default-on check `undeclared-dependencies`: a runtime source file importing a package its own `package.json` does not declare (it resolves only because the root or a sibling member declares it) is an error; tests, tool configs, setup files and member-level `scripts/`/`tools/` may also rely on any ancestor manifest naming the manifest and the packages to add. It reads imports itself, so it needs no external tool; `@types/<name>` counts as a declaration, and `ignorePackages` / `excludePaths` handle aliases and generated sources. Turn it off with `skipChecks: ["undeclared-dependencies"]`. The registry now holds seven checks, and `coreConformance` registers one more test.
