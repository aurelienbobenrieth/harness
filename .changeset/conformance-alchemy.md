---
"@aurelienbbn/conformance-alchemy": minor
---

`alchemy-state-gitignored` finds stack files by content when `stackFiles` is unset: every `alchemy.run.ts` (fast path) plus any other source file that imports `alchemy` and calls its stack factory (`Alchemy.Stack(...)`, `Stack.make(...)`, `alchemy("app")`), so a stack in `infra/stack.ts` is checked instead of failing with "no stack file". Test, declaration, `dist` and `node_modules` files are skipped. An explicit `stackFiles` still wins. A project whose `.alchemy/` is not ignored next to such a file now reports an error it did not before.
