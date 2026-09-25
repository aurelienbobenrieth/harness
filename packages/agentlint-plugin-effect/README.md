# @aurelienbbn/agentlint-plugin-effect

**3 agentlint reviews for Effect: Schema-owned contracts, bounded retries, layers built once.**

> [!WARNING]
> Requires the engine `@aurelienbbn/agentlint` `>=0.3.0 <0.4.0` as a peer. [Evidence](../../docs/compatibility.md#agentlint-engine).

## Quick start

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-effect#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` keeps an existing config and prints the install command; never installs. **Calibrate bindings before requiring `agentlint check --all`.**

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { layerIdentity, resiliencePolicy, strictPreset } from "@aurelienbbn/agentlint-plugin-effect";

export default defineConfig({ extends: [strictPreset], rules: [layerIdentity, resiliencePolicy] });
```

## Rules

| Rule                      | strict | starter | Authority | Standard rev | Detector |
| ------------------------- | :----: | :-----: | --------- | :----------: | :------: |
| `prefer-schema-contracts` |   ✅   |   ✅    | agent     |      2       |    2     |
| `resilience-policy`       |   🧪   |         | agent     |      1       |    1     |
| `layer-identity`          |   🧪   |         | agent     |      1       |    1     |

✅ in preset · 🧪 opt-in, register explicitly. Presets ignore `**/*.d.ts`.

```ts
export interface User {
  id: string;
} // ❌ prefer-schema-contracts
export type User = (typeof User)["Type"]; // ✅ Schema-derived

Effect.tryPromise({ try: () => fetch(url), catch: toError }); // ❌ resilience-policy
Effect.tryPromise({ try: () => fetch(url), catch: toError }).pipe(Effect.timeout("2 seconds")); // ✅

const makeDbLayer = (config: DbConfig) => Layer.effect(Db, connect(config)); // ❌ layer-identity: new pool per call
const makeConfigLayer = (config: DbConfig) => Layer.succeed(Config, config); // ✅
```

<details>
<summary><code>prefer-schema-contracts</code>: fires, silent spellings, source</summary>

Fires on exported interfaces and exported object type aliases, found through the real parser's enclosing export statement. Internal compile-time interfaces and generic helpers may stay manual.

```ts
export type User = (typeof User)["Type"]; // ✅ silent
export type UserEncoded = typeof User.Encoded; // ✅ silent
export type User = Schema.Schema.Type<typeof User>; // ✅ silent
export type UserEncoded = Schema.Codec.Encoded<typeof User>; // ✅ silent
export interface User extends Schema.Schema.Type<typeof UserSchema> {} // ✅ silent
// also silent: typeof X["Encoded"], typeof X.Type
```

The fix for a manual alias: run `@effect/tsgo`'s `typeToEffectSchema`, `typeToEffectSchemaClass`, or `structuralTypeToSchema` (recursive) refactor on it instead of re-typing the Schema by hand.

Spelling source: Effect 4 docs (`effect/ai-docs/src/01_effect/02_schema/10_schema-basics.ts` in `effect@4.0.0-rc.115`) derive types with `typeof Contract["Type"]` / `typeof Contract["Encoded"]`; dotted and `Schema.Schema.Type<typeof Contract>` spellings are recognized too.

</details>

<details>
<summary><code>resilience-policy</code>: triggers and option</summary>

| Fires on                                                                                   | Silent when                                              |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| every `Effect.retry` / `Effect.retryOrElse` call                                           | test file                                                |
| `Effect.tryPromise`, `HttpClient.get\|post\|put\|patch\|del\|head\|options\|execute` calls | enclosing statement or function shows a timeout or retry |

```ts
request.pipe(Effect.retry(Schedule.exponential("100 millis"))); // ❌ fires: no bound
```

`defineResiliencePolicy({ outboundCallPattern })` replaces the outbound call pattern. Effect-dialect sibling of `core/boundary-resilience`.

</details>

<details>
<summary><code>layer-identity</code>: triggers and silent cases</summary>

Layers are memoized by reference: a factory called at two composition sites builds two pools. Fires on functions, arrows and methods returning a `Layer.*` expression. Silent: `Layer.succeed`, `Layer.empty`, `Layer.fresh`, `LayerMap` lookups, test files. The judge counts call sites across the repository.

```ts
const tenants = LayerMap.make((tenant: string) => Layer.effect(Db, connect(tenant))); // ✅ silent
```

</details>

<details>
<summary>Agentlint rule contract</summary>

| Fact                | Detail                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| rule shape          | `lifecycle`, `standard` (revision), `detector` (version), `binding` (id, authority, scope, material options)                  |
| composing           | `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`; repeated uses need distinct binding ids |
| authority           | defaults permit agent acceptance; repository owners choose scope and can raise authority to `human`                           |
| accepting a finding | requires matching current evidence **and** authority                                                                          |
| fixtures            | `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser                           |

</details>

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                | Trigger or review scope                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layer-identity`          | Flags functions that return a newly built Layer so call sites get reviewed for duplicate resource construction.                                         |
| `prefer-schema-contracts` | Flags exported manual object contracts that need Effect Schema ownership.                                                                               |
| `resilience-policy`       | Flags Effect.retry policies and outbound Effect calls that show no timeout so the bound, jitter, retryable-only predicate and idempotency get reviewed. |

<!-- harness-catalog:end -->

## Credits

`starterPreset` onboarding: conceptual inspiration from desloppify by Peter O'Malley; no code or guidance copied.
