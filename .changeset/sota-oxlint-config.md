---
"@aurelienbbn/oxlint-config": minor
---

Restore the `oxc` plugin that the explicit plugin list dropped (its three modern-syntax bans stay off), resolve every mutually exclusive rule pair and typed/untyped duplicate, scope the `vitest` plugin to test files through `overrides`, enable `typescript/no-unnecessary-condition`, and require exhaustive union switches without `default` in place of `eslint/default-case`. Add `nurseryCandidateRules` and the opt-in `withTanstackQueryLayer`, which loads `@tanstack/eslint-plugin-query` through `jsPlugins` with a `companionPlugins` extension point.

Migration: existing code can newly fail on `oxc/*`, `typescript/no-unnecessary-condition` and `default` branches of exhaustive union switches. `vitest/*` rule overrides now belong in an `overrides` entry for test files, and `plugins` no longer contains `vitest`.
