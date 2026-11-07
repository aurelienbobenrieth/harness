---
"@aurelienbbn/oxlint-plugin-core": minor
---

Precision fixes found by linting 25 projects.

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
