---
"@aurelienbbn/oxlint-plugin-cloudflare": patch
---

Worker detection no longer treats Bun, Deno or one-parameter `fetch(request)` default exports as Workers, so `no-module-scope-request-state` and `mysql2-disable-eval` stay silent on long-lived Node-style servers. `mysql2-disable-eval` reads `env` only when it is a parameter, `no-detached-execution-context-method` accepts members of a `cloudflare:workers` namespace held in a variable, `no-interpolated-sql` accepts imported SCREAMING_CASE table constants, `no-module-scope-request-state` accepts `WeakMap`/`WeakSet` caches, and `timing-safe-secret-compare` skips env names that describe a secret (`TOKEN_TYPE`, `AUTH_TOKEN_HEADER`).
