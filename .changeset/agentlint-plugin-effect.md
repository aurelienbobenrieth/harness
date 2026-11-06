---
"@aurelienbbn/agentlint-plugin-effect": minor
---

New `conversion-keeps-failure` (strict and starter preset): a `mapError`, `orElseFail`, `catch` or `tryPromise` handler that replaces a failure without reading it reports for review, so an outage does not leave only an empty error behind. It stays silent when the handler reads the failure, when a `tapError`-style step saw it first, and when the source only says a value was absent or input did not decode.

New `refusal-reason-reaches-reader` (strict and starter preset): an RPC or HTTP API error carrying a `reason` that no runtime file in the checkout tells apart reports for review, so a refusal the user could act on does not end as a generic "retry". It stays silent for an error that sends its own `message`, and for a checkout where no wire error is read at all. `transaction-no-network` no longer reads folders starting with a dot, such as generated bundles.

Replace the three lexical rules with one that follows code across files.

- Removed `layer-identity`, `resilience-policy` and `prefer-schema-contracts`: an audit on two applications and the Effect repositories found no true positive for a detector that sees one file and no types (domain types are the oxlint rule `effect/schema-domain-types`; failure and runtime rules live in `@aurelienbbn/oxlint-plugin-effect`).
- New `transaction-no-network` (strict and starter preset): a database transaction (`sql.withTransaction`, `effect.pipe(…, sql.withTransaction)`, Drizzle/Knex/TypeORM `db.transaction(fn)`, Prisma `$transaction(fn)`, Kysely `transaction().execute(fn)`) whose work reaches `fetch`, an HTTP client or a service whose layer calls one reports on the opener, with the path. Reach follows imports and re-exports inside the workspace member and skips test code. `defineTransactionNoNetwork({ openers, curriedOpeners, networkModules, networkServices })` names project openers and network services that cannot be inferred. The finding's evidence carries a digest of every declaration on the path, so an acceptance reopens when a reached file changes.
- New dependency `oxc-parser` (syntax only, read lazily).
