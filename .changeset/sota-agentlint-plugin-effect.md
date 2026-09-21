---
"@aurelienbbn/agentlint-plugin-effect": minor
---

Add two opt-in review rules, registered outside every preset. `effect/resilience-policy` reports `Effect.retry` / `Effect.retryOrElse` policies and `Effect.tryPromise` / `HttpClient.*` calls that show no timeout, so the bound, jitter, retryable-only predicate, per-attempt timeout and idempotency get reviewed (outbound pattern configurable through `defineResiliencePolicy`). `effect/layer-identity` reports functions that return a newly built `Layer` so call sites get reviewed for duplicate resource construction; `Layer.succeed`, `Layer.empty`, `Layer.fresh` and `LayerMap` lookups stay silent. `effect/prefer-schema-contracts` (standard revision 2, detector version 2) now treats `typeof X["Type"]` / `typeof X["Encoded"]`, `Schema.Schema.Type<typeof X>`, `Schema.Codec.Encoded<typeof X>` and an empty interface extending such a type as schema-derived.
