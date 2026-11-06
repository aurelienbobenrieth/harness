---
"@aurelienbbn/oxlint-plugin-shopify-app": minor
---

`functions-no-unavailable-runtime-apis` now lints only files under an extension whose `*.extension.toml` declares `type = "function"` (test files excluded). It accepts `{ "scope": "all" }` to keep the previous behavior of linting every file it is enabled for.

Removes `shopify-app/require-fetch-abort-signal`: the generic `core/require-fetch-abort-signal` (`@aurelienbbn/oxlint-plugin-core`) now covers every `fetch` call in any project. Replace the rule name in configs; the `scope` option is gone.

Fix `no-swallowed-auth-response` crashing with `contextMethods[owner]?.has is not a function` on any member call whose owner is an inherited object key (`constructor`, `toString`, `hasOwnProperty`): the owner lookup now uses a `Map`.

Ignore inherited object keys when identifying auth and billing calls instead of crashing on constructor or toString owners.

Scope Function runtime restrictions to source beneath a shopify.extension.toml declaring type = "function" (modern extensions array or legacy top-level declaration). App server and UI extension APIs stay available.
