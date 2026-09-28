# @aurelienbbn/oxlint-plugin-alchemy

[![npm](https://img.shields.io/npm/v/@aurelienbbn/oxlint-plugin-alchemy)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-alchemy) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/oxlint-plugin-alchemy)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-alchemy) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/oxlint-plugin-alchemy)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-alchemy/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/oxlint-plugin-alchemy)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-alchemy/package.json)

**4 oxlint rules for Alchemy v2 (Infrastructure as Effects): code that type-checks and deploys, then misbehaves because it runs in the wrong phase or the wrong scope.**

> [!NOTE]
> **Release candidate.** Checked against `alchemy` 2.0.0-beta.79. No consumer has calibrated it yet.

```sh
pnpm add -D @aurelienbbn/oxlint-plugin-alchemy oxlint   # oxlint >=1.82.0 <2.0.0
```

```json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-alchemy"],
  "rules": {
    "alchemy/config-in-init": "error",
    "alchemy/no-disposable-in-instance-scope": "error",
    "alchemy/worker-env-secret-literal": "error",
    "alchemy/workflow-io-outside-task": "error"
  }
}
```

No preset. **No autofix:** every fix needs a choice (where the value is read, where the resource lives, what the step is called), so every rule reports only.

## What fires

```ts
export default Cloudflare.Worker(
  "Api",
  { main: import.meta.url, env: { STRIPE_SECRET: "sk_live_..." } }, // ❌ worker-env-secret-literal: bound as plain_text
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(openPool, close); // ❌ no-disposable-in-instance-scope: never released on workerd
    const apiKey = yield* Config.Redacted("API_KEY"); // ✅ read in the init, so Alchemy binds it
    return {
      fetch: Effect.gen(function* () {
        const host = yield* Config.String("HOST"); // ❌ config-in-init: never bound, missing at runtime
        const again = yield* Config.Redacted("API_KEY"); // ✅ already bound by the init
      }),
    };
  }),
);

export class Sync extends Cloudflare.Workflow<Sync>()(
  "Sync",
  Effect.gen(function* () {
    const kv = yield* Cloudflare.KV.ReadWriteNamespace(KV);
    return Effect.fn(function* (input: { id: string }) {
      yield* kv.put(input.id, "started"); // ❌ workflow-io-outside-task: runs again on every replay
      yield* Cloudflare.Workflows.task("store", kv.put(input.id, "done")); // ✅ checkpointed
    });
  }),
) {}
```

<details>
<summary>Exact triggers and scope per rule</summary>

| Rule                              | ❌ Fires on                                                                                                                                                                                                                                                                                                         | Matched / ⏭️ skipped                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config-in-init`                  | `Config.<constructor>(..., "KEY")` (`String`, `Redacted`, `Number`, `Port`, `schema`, ...; Effect 3 lowercase names too) inside what the init returns (inline, or a `const` `Effect.gen` / `Effect.fn` handler returned by reference): handlers, RPC methods, the Durable Object instance effect, the Workflow body | ⏭️ keys also read in the init body or in the `env` prop of the same declaration, values the init `yield*`s inside the returned object or runs itself (`yield* warmup`), non-literal keys                                                          |
| `no-disposable-in-instance-scope` | `Effect.acquireRelease`, `Effect.acquireDisposable`, `Effect.addFinalizer` whose nearest function is a Runtime init generator, or the per-object constructor a Durable Object init returns                                                                                                                          | ⏭️ handlers and methods (per-event scope), arguments of `Effect.scoped(...)`, `Effect.acquireUseRelease` (releases itself), helper functions                                                                                                      |
| `worker-env-secret-literal`       | a non-empty string literal, a template literal, `process.env.X`, or a `??` / `\|\|` fallback of one, as the value of a secret-named key in a Cloudflare Worker `env` prop                                                                                                                                           | Keys matching `secretPattern` (default `SECRET`, `TOKEN`, `PASSWORD`, `API_KEY`, `PRIVATE_KEY`, `DSN`, `DATABASE_URL`, ...) and not `benignPattern` (default `PUBLIC`, `PUBLISHABLE`, `_TTL`, `_NAME`, ...). ⏭️ `Config.*`, `Redacted.make`, `""` |
| `workflow-io-outside-task`        | a method call on `const x = yield* <Alchemy binding>` (anything imported from `alchemy/*`) from the Workflow init, made directly in the Workflow body (`Effect.fn(...)`, `Effect.fn(name)(...)`, or an arrow returning `Effect.gen`)                                                                                | ⏭️ calls inside `Cloudflare.Workflows.task(...)` arguments (effect and rollback), calls in nested functions, receivers yielded from your own services                                                                                             |

Runtimes are recognized syntactically: `Cloudflare.Worker`, `Cloudflare.DurableObject`, `Cloudflare.Workflow` and `AWS.Lambda.Function`, called inline (`X(id, props, init)`), in class form (`X<Self>()(id, props, init)`), or as `Tag.make(props, init)` on a tag class declared in the same file. The init must be written inline as `Effect.gen(...)` or `Effect.succeed(...)`, optionally piped.

</details>

## Limits

- **Single-file view.** Inits built in another file, passed by identifier, or composed from Layers are invisible. A `Tag.make` on a tag imported from another file is not recognized.
- **`config-in-init` false positive:** a key bound by a different declaration (a Layer, the host Worker of a Workflow) is reported. Suppress the line, or read the key in this init too.
- **`workflow-io-outside-task` is deliberately narrow:** only direct calls on `yield*` Alchemy bindings; I/O through your own services or helper functions is not seen.
- **Other Alchemy Platforms** (ECS, Containers, Railway, Fly, ...) are not recognized: their instance-scope semantics differ (servers run finalizers on graceful exit).

<details>
<summary>Not shipped, and who owns it</summary>

| Concern                                                   | Owner                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| secret-named `Config.String` instead of `Config.Redacted` | `effect/require-redacted-secret-config` in `@aurelienbbn/oxlint-plugin-effect` |
| `Date.now()`, `Math.random()`, timers inside Effects      | `@effect/tsgo` (`global-date*`, `global-random*`, `global-timers-in-effect`)   |
| native `WorkflowEntrypoint` determinism, secret compares  | `@aurelienbbn/oxlint-plugin-cloudflare`                                        |
| binding existence, `Env` types, deploy validity           | Alchemy's own types and `alchemy deploy`                                       |

</details>

**Credit:** every rule independently implements behavior documented by Alchemy (alchemy-run/alchemy, Apache-2.0): Secrets & Config, Runtime (instance scope vs request scope), Cloudflare Workers `env` bindings, Cloudflare Workflows replay semantics; no documentation text or code copied.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                        | Trigger or review scope                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config-in-init`                  | Require effect/Config keys read inside the handlers, Durable Object instance, or Workflow body returned by an Alchemy Runtime init to also be read in the init itself, where Alchemy binds them at deploy time.                                  |
| `no-disposable-in-instance-scope` | Forbid Effect.acquireRelease, Effect.acquireDisposable and Effect.addFinalizer directly in an Alchemy Runtime init (Cloudflare Worker, Durable Object, Workflow, AWS Lambda Function) outside the handlers it returns.                           |
| `worker-env-secret-literal`       | Forbid string literals, template literals and process.env reads as values of secret-named keys (SECRET, TOKEN, PASSWORD, API_KEY, DSN, ...) in the env prop of an Alchemy Cloudflare Worker; bind them with Config.Redacted or a Redacted value. |
| `workflow-io-outside-task`        | Require method calls on bindings yielded from Alchemy in a Cloudflare Workflow init (KV, R2, D1, Durable Objects, ...) to run inside Cloudflare.Workflows.task() when made directly in the Workflow body.                                        |

### Credited concepts

- https://alchemy.run/cloudflare/compute/workers (alchemy-run/alchemy docs and Cloudflare/Workers/Worker.ts `env` JSDoc, Apache-2.0; inspiration, independently implemented)
- https://alchemy.run/cloudflare/compute/workflows (alchemy-run/alchemy docs, Apache-2.0; inspiration, independently implemented)
- https://alchemy.run/environments/secrets (alchemy-run/alchemy docs, Apache-2.0; inspiration, independently implemented)
- https://alchemy.run/infrastructure-as-effects/runtime (alchemy-run/alchemy docs, Apache-2.0; inspiration, independently implemented)

<!-- harness-catalog:end -->
