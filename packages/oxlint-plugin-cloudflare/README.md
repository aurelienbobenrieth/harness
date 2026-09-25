# @aurelienbbn/oxlint-plugin-cloudflare

[![npm](https://img.shields.io/npm/v/@aurelienbbn/oxlint-plugin-cloudflare)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-cloudflare) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/oxlint-plugin-cloudflare)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-cloudflare) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/oxlint-plugin-cloudflare)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-cloudflare/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/oxlint-plugin-cloudflare)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-cloudflare/package.json)

**7 oxlint rules for Cloudflare Workers, Durable Objects, and Workflows: bugs that type-check and pass `wrangler deploy`, then fail under real traffic.**

> [!NOTE]
> **Release candidate.** No consumer has calibrated it yet.

```sh
pnpm add -D @aurelienbbn/oxlint-plugin-cloudflare oxlint   # oxlint >=1.82.0 <2.0.0
```

```json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-cloudflare"],
  "rules": {
    "cloudflare/no-module-scope-request-state": "error",
    "cloudflare/no-interpolated-sql": "error",
    "cloudflare/workflow-deterministic-steps": "error",
    "cloudflare/no-detached-execution-context-method": "error",
    "cloudflare/durable-object-init-concurrency": "error",
    "cloudflare/mysql2-disable-eval": "error",
    "cloudflare/timing-safe-secret-compare": "error"
  }
}
```

No preset. **One autofix:** `mysql2-disable-eval` adds `disableEval: true` to an options object literal; every other rule reports only.

## What fires

```ts
const client = new Client(env.HYPERDRIVE.connectionString); // ❌ no-module-scope-request-state
export default {
  async fetch(request, env, ctx) {
    const { waitUntil } = ctx; // ❌ no-detached-execution-context-method: throws "Illegal invocation"
    await env.DB.prepare(`SELECT * FROM users WHERE id = ${id}`).first(); // ❌ no-interpolated-sql
    await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first(); // ✅
  },
};

class Sync extends WorkflowEntrypoint {
  async run(event, step) {
    await step.do(`sync ${Date.now()}`, async () => {}); // ❌ workflow-deterministic-steps: never replays from cache
    const id = await step.do("make id", async () => crypto.randomUUID()); // ✅
  }
}
```

<details>
<summary>Exact triggers and scope per rule</summary>

| Rule                                   | ❌ Fires on                                                                                                                                                                                                                                                                                                   | Matched / ⏭️ skipped                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-module-scope-request-state`        | a TCP client built at module scope (`pg` `Client`/`Pool`, `postgres()`, mysql2 `createConnection`/`createPool`/`createPoolCluster`, `drizzle` from `node-postgres`/`postgres-js`/`mysql2`); a module-scope variable assigned, updated, deleted from, or mutated by `push`/`set`/`add`/... inside any function | Worker modules only: importing `cloudflare:workers`, or default-exporting a handler object. ⏭️ class fields (Durable Object instance state), Drizzle D1/HTTP drivers, Prisma (safety depends on the adapter), helper modules that aren't Worker modules |
| `no-interpolated-sql`                  | a template literal or `+` concatenation with a runtime value as the SQL of `env.X.prepare` / `env.X.exec` (also `this.env`, `c.env`, a `const db = env.X` alias) or `<x>.sql.exec` / `sql.exec`; a `const` holding such SQL                                                                                   | ⏭️ interpolated literals and `const` literals (table names), tagged templates such as `` this.sql`...` ``                                                                                                                                               |
| `workflow-deterministic-steps`         | `Date.now()`, `Math.random()`, `performance.now()`, `crypto.randomUUID()`, `crypto.getRandomValues()`, argument-less `new Date()` in a `step.do` / `sleep` / `sleepUntil` / `waitForEvent` name, or anywhere in `run()` outside a `step.do` callback                                                          | `run(event, step)` of a class extending `WorkflowEntrypoint` from `cloudflare:workers`. ⏭️ `Promise.race` / `Promise.any` (not checked), steps passed to helper functions                                                                               |
| `no-detached-execution-context-method` | `waitUntil` / `passThroughOnException` destructured (including in parameters), or read without a call and stored, passed, returned, or placed in an object/array                                                                                                                                              | ⏭️ `.bind(ctx)`, `.call(ctx)`, optional calls, truthiness checks, the standalone `waitUntil` export of `cloudflare:workers`                                                                                                                             |
| `durable-object-init-concurrency`      | in a `DurableObject` constructor: `fetch`, async `storage.get`/`put`/`list`/`delete`/`transaction`/alarm calls, an async IIFE, or `this.<asyncMethod>()`, outside a callback; inside any `blockConcurrencyWhile` callback: `fetch` or an I/O method on an `env` binding                                       | ⏭️ synchronous `storage.sql.exec` and `storage.kv`, callbacks that run later. `env.MY_DO.get(id)` inside the callback is reported although it only builds a stub                                                                                        |
| `mysql2-disable-eval`                  | an options object literal for mysql2 `createConnection` / `createPool` / `createPoolCluster` without `disableEval`, or with a value other than literal `true`                                                                                                                                                 | Worker modules, or options reading `env.X` (not `process.env`). ⏭️ options with spreads, options passed by identifier or URI. Fix inserts `disableEval: true` only when the property is absent                                                          |
| `timing-safe-secret-compare`           | `===` / `!==` / `==` / `!=` where one side is, or is a template embedding, `env.<NAME>` with NAME matching `SECRET`, `TOKEN`, `PASSWORD`, `PASSPHRASE`, `API_KEY`, `PRIVATE_KEY`, `SIGNING_KEY`, `SIGNATURE`, `CREDENTIAL`                                                                                    | ⏭️ comparisons with `undefined`, `null`, `""`, `typeof`; `process.env`                                                                                                                                                                                  |

</details>

<details>
<summary>Not shipped, and who owns it</summary>

| Concern                                              | Owner                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| unawaited promises, RPC calls, and steps             | typed `typescript/no-floating-promises` in the strict preset                  |
| stale or hand-written `Env` types                    | `wrangler types --check`; a hand-written `Env` has no sound syntactic trigger |
| `Date.now()` in alarms                               | ❌ no rule: `setAlarm(Date.now() + n)` is the correct idiom                   |
| product choice (KV vs D1 vs DO, Queues vs Workflows) | Cloudflare's `workers-best-practices` and `durable-objects` skills            |
| raw SQL outside Cloudflare receivers                 | `eslint-plugin-sql` `no-unsafe-query`                                         |

</details>

**Credit:** every rule independently implements guidance from Cloudflare's developer documentation (Workers best practices, Rules of Durable Objects, Rules of Workflows, D1, Durable Object SQLite storage, Hyperdrive driver pages); no documentation text or code copied.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                             | Trigger or review scope                                                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `durable-object-init-concurrency`      | Require async work in a DurableObject constructor (storage reads, fetch, async methods or IIFEs) to run inside ctx.blockConcurrencyWhile(), and forbid fetch or binding calls inside a blockConcurrencyWhile() callback. |
| `mysql2-disable-eval`                  | Require disableEval: true in object-literal options passed to mysql2 createConnection / createPool / createPoolCluster in Worker code.                                                                                   |
| `no-detached-execution-context-method` | Forbid destructuring waitUntil / passThroughOnException from an execution context, or passing, storing, or returning them without their receiver.                                                                        |
| `no-interpolated-sql`                  | Forbid template-literal interpolation or string concatenation of runtime values into SQL passed to D1 prepare()/exec() or Durable Object sql.exec(); bind parameters instead.                                            |
| `no-module-scope-request-state`        | Forbid per-request state at Worker module scope: TCP database clients (pg, postgres, mysql2, their Drizzle drivers) built at module scope, and module-scope variables assigned or mutated from inside a function.        |
| `timing-safe-secret-compare`           | Forbid ===, !==, == and != comparisons against secret-named env values (SECRET, TOKEN, PASSWORD, API_KEY, SIGNATURE, ...); compare with crypto.subtle.timingSafeEqual().                                                 |
| `workflow-deterministic-steps`         | Forbid Date.now(), Math.random(), performance.now(), crypto.randomUUID(), crypto.getRandomValues() and new Date() in Workflow step names, or anywhere in WorkflowEntrypoint.run() outside a step.do() callback.          |

### Credited concepts

- https://developers.cloudflare.com/d1/worker-api/d1-database/ (inspiration; independently implemented)
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ (inspiration; independently implemented)
- https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/ (inspiration; independently implemented)
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/mysql-drivers-and-libraries/mysql2/ (inspiration; independently implemented)
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/ (inspiration; independently implemented)
- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ (inspiration; independently implemented)
- https://developers.cloudflare.com/workflows/build/rules-of-workflows/ (inspiration; independently implemented)

<!-- harness-catalog:end -->
