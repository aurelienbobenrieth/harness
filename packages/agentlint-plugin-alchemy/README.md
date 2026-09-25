# @aurelienbbn/agentlint-plugin-alchemy

[![npm](https://img.shields.io/npm/v/@aurelienbbn/agentlint-plugin-alchemy)](https://www.npmjs.com/package/@aurelienbbn/agentlint-plugin-alchemy) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/agentlint-plugin-alchemy)](https://www.npmjs.com/package/@aurelienbbn/agentlint-plugin-alchemy) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/agentlint-plugin-alchemy)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/agentlint-plugin-alchemy/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/agentlint-plugin-alchemy)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/agentlint-plugin-alchemy/package.json)

**6 agentlint reviews for Alchemy v2 stacks: no silent replacement, no silent data deletion, no silent takeover.**

> [!WARNING]
> Requires the engine `@aurelienbbn/agentlint` `>=0.3.0 <0.4.0` as a peer. [Evidence](../../docs/compatibility.md#agentlint-engine).

> [!NOTE]
> Checked against `alchemy@2.0.0-beta.79`. Release candidate: no consumer has calibrated these rules yet. Alchemy is in beta; replace triggers and defaults can move between betas.

## Quick start

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-alchemy#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` keeps an existing config and prints the install command; never installs. **Change rules need the merge base: check out with full history (`fetch-depth: 0`) in CI.**

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { initConfigExposure, strictPreset } from "@aurelienbbn/agentlint-plugin-alchemy";

export default defineConfig({ extends: [strictPreset], rules: [initConfigExposure] });
```

## Rules

| Rule                          | strict | starter | Authority | Lifecycle | Fires on                                                                                           |
| ----------------------------- | :----: | :-----: | --------- | --------- | -------------------------------------------------------------------------------------------------- |
| `resource-replacement-review` |   ✅   |   ✅    | human     | change    | logical ID changed without `renamedFrom`, declaration removed, replace prop changed, stack renamed |
| `state-store-change`          |   ✅   |   ✅    | human     | change    | `state:` option of `Alchemy.Stack` changed                                                         |
| `removal-policy-change`       |   ✅   |         | human     | change    | `RemovalPolicy.retain(...)` removed or narrowed, `destroy()` added, `forceDestroy: true` set       |
| `removal-policy-review`       |   ✅   |         | agent     | state     | R2, D1, KV declaration with no removal policy, or a `retain` condition reading `Stage`             |
| `adopt-review`                |   ✅   |         | human     | state     | `AdoptPolicy.adopt(...)`, `--adopt` in package.json scripts                                        |
| `init-config-exposure`        |   🧪   |         | agent     | state     | `yield* Config.*("KEY")` directly in a Worker, Container or Lambda init                            |

✅ in preset · 🧪 opt-in, register explicitly. Presets ignore `**/*.d.ts`. Every rule is standard revision 1, detector version 1.

Human authority where the answer lives outside the code: whether data in a deployed stage may go, whether a cloud resource someone else owns may be taken over. `removal-policy-review` stays agent-acceptable because disposability is usually visible in code (cache, preview, fixture); raise it to `human` in your binding if it isn't.

```diff
-yield* Cloudflare.R2.Bucket("Bucket");
+yield* Cloudflare.R2.Bucket("Assets"); // ❌ resource-replacement-review: new empty bucket, old one deleted
+yield* Cloudflare.R2.Bucket("Assets").pipe(Alchemy.renamedFrom("Bucket")); // ✅ state row migrates

-yield* Cloudflare.D1.Database("Orders", { primaryLocationHint: "weur" });
+yield* Cloudflare.D1.Database("Orders", { primaryLocationHint: "apac" }); // ❌ D1 plans a replace

-  state: localState(),
+  state: Cloudflare.state(), // ❌ state-store-change: next deploy plans against empty state
```

```ts
Cloudflare.D1.Database("Orders"); // ❌ removal-policy-review: default destroy
Cloudflare.D1.Database("Orders").pipe(RemovalPolicy.retain(stack.stage === "prod")); // ✅

Cloudflare.D1.Database("Db").pipe(RemovalPolicy.retain(Effect.map(Alchemy.Stage, isProd))); // ❌ alchemy#1738

deploy(program).pipe(AdoptPolicy.adopt(true)); // ❌ adopt-review
```

<details>
<summary><code>resource-replacement-review</code>: replace triggers and options</summary>

Replace triggers, read from each provider's `diff` in `alchemy@2.0.0-beta.79`:

| Resource       | Replaces on                                                                 | Stays in place                                                                                                   |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `R2.Bucket`    | `name` set or changed, `jurisdiction`, `locationHint`                       | `name` removed (deployed name kept), unset ⇄ `jurisdiction: "default"`, `storageClass`, domains, CORS, lifecycle |
| `D1.Database`  | `name` set or changed, `jurisdiction`, `primaryLocationHint` set or changed | `name` or `primaryLocationHint` removed, unset ⇄ `jurisdiction: "default"`, `readReplication`                    |
| `KV.Namespace` | nothing: `title` renames in place                                           | `title`                                                                                                          |

A logical-ID change is paired with an added declaration of the same type; a removed declaration that already carried an unconditional `RemovalPolicy.retain()` stays silent. Declarations moved between files stay silent.

`defineResourceReplacementReview({ resources })` replaces the map: `{ "Queues.Queue": { name: "changed" } }`. `"changed"` fires on any difference including removal; `"set"` only when the after side sets a differing value; `{ trigger, absent }` compares an unset prop as `absent`.

</details>

<details>
<summary><code>removal-policy-change</code> and <code>removal-policy-review</code>: what counts as a policy</summary>

`removal-policy-change` compares `RemovalPolicy.retain(...)` / `RemovalPolicy.destroy(...)` calls across the whole change, so a moved call is silent and a retain that leaves with its removed declaration is left to `resource-replacement-review`. `retain()`, `retain(true)` and `destroy(false)` are the same policy, as are `destroy()`, `destroy(true)` and `retain(false)`; a switch to unconditional retain never fires. `forceDestroy: true` fires only on a bucket that existed before the change: without it R2 refuses to delete a non-empty bucket.

`removal-policy-review` accepts any enclosing `.pipe(...)` that mentions `retain` (including helpers such as `retainOnDeployedStage`) or `RemovalPolicy.destroy`. It fires separately when the `retain` argument reads `Stage`: the Effect form fails inside Effect-native Workers (alchemy#1738, open); read the stage from `Alchemy.Stack` instead.

Both take `{ resources }`, default `["R2.Bucket", "D1.Database", "KV.Namespace"]`.

</details>

<details>
<summary><code>init-config-exposure</code>: why it is opt-in</summary>

Alchemy binds every config key a runtime's init loads onto the deployed runtime, `secret_text` on Cloudflare, with the deployer's value. That is the documented way to ship a secret, so most findings are intended: calibrate before enforcing. Handler-time reads (`fetch: Effect.gen(...)`) and props effects stay silent. `defineInitConfigExposure({ runtimePattern })` replaces the constructor pattern.

</details>

## Limits

- **Lexical, not semantic.** Change rules read before/after text: computed logical IDs compare as expressions, props passed as variables or Effects are not compared, `Namespace.push` moves are invisible, a `state` option given as an identifier resolves only through a single same-file `const`, and regex literals in stack files can confuse the scanner.
- **Named imports are missed.** Resources are recognized as `R2.Bucket(`, `D1.Database(`, `KV.Namespace(` behind any namespace; `import { Bucket }` then `Bucket(...)` is not.
- **Only the three Cloudflare stores by default.** Durable Objects, Queues, Hyperdrive and AWS stores need an explicit `resources` map.
- **YAML is not scanned.** `--adopt` in GitHub workflow files is invisible: agentlint state rules parse JS, TS and JSON only.
- **Transitive config reads are invisible.** A library reading `Config` during init is bound too (alchemy#1842); only direct `yield* Config.*("KEY")` fires.
- **Not a plan.** `alchemy plan` is the ground truth; these rules make sure someone reads it.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                    | Trigger or review scope                                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adopt-review`                | Flags AdoptPolicy.adopt(...) and `--adopt` in package.json scripts, which let Alchemy take over cloud resources it cannot prove it owns.                                                       |
| `init-config-exposure`        | Flags each effect/Config key yielded in an Alchemy runtime init body, which Alchemy uploads to the deployed runtime as a secret binding.                                                       |
| `removal-policy-change`       | Flags diffs that remove or narrow RemovalPolicy.retain, add RemovalPolicy.destroy, or set forceDestroy on an existing R2 bucket, so a human confirms the data may be deleted.                  |
| `removal-policy-review`       | Flags stateful Alchemy resources (R2, D1, KV) on the default destroy removal policy, and retain conditions that read Stage through an Effect.                                                  |
| `resource-replacement-review` | Flags diffs that make Alchemy replace or delete a stateful resource: a logical ID changed without renamedFrom, a declaration removed, a replace-triggering prop changed, or the stack renamed. |
| `state-store-change`          | Flags a changed `state:` option on Alchemy.Stack so a human confirms how existing state moves to the new store.                                                                                |

### Credited concepts

- Alchemy AdoptPolicy, alchemy/src/AdoptPolicy.ts 2.0.0-beta.79, and https://alchemy.run/cli/adopting-resources (Apache-2.0 project; concept, independently implemented)
- Alchemy RemovalPolicy, alchemy/src/RemovalPolicy.ts 2.0.0-beta.79, and https://alchemy.run/infrastructure-as-code/resource-lifecycle (Apache-2.0 project; concept, independently implemented)
- Alchemy provider diff functions in alchemy/src/Cloudflare/R2/Bucket.ts and D1/Database.ts, 2.0.0-beta.79 (Apache-2.0; replace triggers read, not copied)
- Alchemy renaming and resource lifecycle docs, https://alchemy.run/infrastructure-as-code/renaming (Apache-2.0 project; concept, independently implemented)
- Alchemy secrets docs, https://alchemy.run/environments/secrets, and alchemy/src/Platform.ts 2.0.0-beta.79 plan-phase config binding (Apache-2.0 project; concept, independently implemented)
- Alchemy state store docs, https://alchemy.run/state-store (Apache-2.0 project; concept, independently implemented)
- alchemy-run/alchemy#1738 (Effect-form retain fails inside Effect-native Workers; reported behavior, not code)
- alchemy-run/alchemy#1842 (deployer credentials bound through init config reads; reported behavior, not code)

<!-- harness-catalog:end -->

## Credits

Concepts from the Alchemy documentation and source (Apache-2.0), re-implemented without copying: [renaming](https://alchemy.run/infrastructure-as-code/renaming), [resource lifecycle and removal policy](https://alchemy.run/infrastructure-as-code/resource-lifecycle), [adopting resources](https://alchemy.run/cli/adopting-resources), [state store](https://alchemy.run/state-store), [secrets and config](https://alchemy.run/environments/secrets), and reported behavior in alchemy-run/alchemy#1248, #1738 and #1842. `starterPreset` onboarding: conceptual inspiration from desloppify by Peter O'Malley; no code or guidance copied.
