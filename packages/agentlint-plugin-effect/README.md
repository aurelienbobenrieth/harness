# @aurelienbbn/agentlint-plugin-effect

Private draft. Development links to the sibling agentlint workspace; packed evidence uses the reviewed local archive; public agentlint 0.1.5 exposes an incompatible API. See the [compatibility evidence](../../docs/compatibility.md#private-draft-boundary).

Custom agentlint rules for projects that use Effect.

## Presets

- `strictPreset`: enables `prefer-schema-contracts`. The opt-in review rules below stay out of every preset; register them explicitly.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

- `prefer-schema-contracts`: exported interfaces and exported object type aliases. Schema-derived spellings stay silent: `typeof X["Type"]` / `typeof X["Encoded"]`, `typeof X.Type` / `typeof X.Encoded`, `Schema.Schema.Type<typeof X>` / `Schema.Codec.Encoded<typeof X>`, and an empty `interface X extends Schema.Schema.Type<typeof XSchema> {}`.
- `resilience-policy` (opt-in, in no preset): every `Effect.retry` / `Effect.retryOrElse` call, plus `Effect.tryPromise` and `HttpClient.get|post|put|patch|del|head|options|execute` calls whose enclosing statement or function shows neither a timeout nor a retry. Test files are excluded. `defineResiliencePolicy({ outboundCallPattern })` replaces the outbound call pattern. Effect-dialect sibling of `core/boundary-resilience`.
- `layer-identity` (opt-in, in no preset): functions, arrows and methods that return a `Layer.*` expression. `Layer.succeed`, `Layer.empty`, `Layer.fresh` and `LayerMap` lookups stay silent. Test files are excluded. The judge counts call sites across the repository.

## Contract boundaries and migration

Exported declarations are inspected through the real parser's enclosing export statement. Schema ownership belongs at runtime boundaries; internal compile-time interfaces and generic helpers may remain manual. Effect 4 documentation (`effect/ai-docs/src/01_effect/02_schema/10_schema-basics.ts` in `effect@4.0.0-rc.115`) derives types with `typeof Contract["Type"]` and `typeof Contract["Encoded"]`; the dotted and `Schema.Schema.Type<typeof Contract>` spellings are recognized as well.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                | Trigger or review scope                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layer-identity`          | Flags functions that return a newly built Layer so call sites get reviewed for duplicate resource construction.                                         |
| `prefer-schema-contracts` | Flags exported manual object contracts that need Effect Schema ownership.                                                                               |
| `resilience-policy`       | Flags Effect.retry policies and outbound Effect calls that show no timeout so the bound, jitter, retryable-only predicate and idempotency get reviewed. |

<!-- harness-catalog:end -->

## Current rule contract

Rules expose `lifecycle`, `standard` (revision), `detector` (version), and `binding` (id, authority, scope, material options). Presets use arrays of bindings: `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`. Configure repeated uses with distinct binding ids. Repository owners choose scope and can raise authority to `human`; defaults permit agent acceptance. Acceptance requires matching current evidence and authority. `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser.

## Start with a focused review

The opt-in `starterPreset` includes `preferSchemaContracts`. Install a compatible local draft of this package and agentlint, then run:

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-effect#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` preserves an existing config and prints the package installation command. It never installs packages itself. Inspect and calibrate the bindings before making `agentlint check --all` required. This gradual onboarding takes conceptual inspiration from desloppify by Peter O'Malley; no code or guidance was copied.
