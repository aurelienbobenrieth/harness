---
"@aurelienbbn/oxlint-plugin-core": minor
"@aurelienbbn/oxlint-config": minor
---

Add four rules to the core plugin and harden the strict config. New rules: no-dead-comments (closing-brace labels, placeholder scaffolding, TODO/FIXME without an issue reference), no-weak-test-assertions (test files with only existence/snapshot assertions and no behavior-pinning assertion), no-reexport-only-modules (re-export-only modules, with an `allow` option defaulting to `["index.ts"]` for entrypoint barrels), and no-let (opt-in ban on `let`/`var`, exported but not in any default config). no-multi-positional-parameters gains `exemptFunctionNames` and `exemptFileBasenames` options. strictOxlintConfig now sets `typescript/ban-ts-comment` so `@ts-ignore` is banned and `@ts-expect-error` requires a description.
