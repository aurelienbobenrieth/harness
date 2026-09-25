# @aurelienbbn/conformance-cloudflare

**6 checks that catch Cloudflare Workers config mistakes Wrangler lets through: stale types, secrets in `vars`, bindings missing in an environment, an old compatibility date, logs off, and a broken Hyperdrive setup.**

```text
 wrangler.jsonc ─┐
 package.json ───┼─▶ cloudflareChecks (6) ─▶ report { passed | incomplete | failed }   Vitest or plain function
 wrangler bin ───┘
```

> [!WARNING]
> **A static preflight.** `wrangler deploy --dry-run`, the config schema, and `tsc` against generated types stay authoritative for config validity and binding existence.

## One file, six tests

```ts
// conformance.test.ts
import { cloudflareConformance } from "@aurelienbbn/conformance-cloudflare/vitest";

cloudflareConformance({ root: process.cwd() });
```

**Errors fail; warnings print. Missing evidence (no wrangler install, a TOML config) shows as a skipped test, never a pass.** `vitest` is an optional peer; Node `^22.19.0 || ^24.11.0`.

```ts
import { runCloudflareConformanceReport } from "@aurelienbbn/conformance-cloudflare";

const report = await runCloudflareConformanceReport({ root: process.cwd() }); // { status, checks[], findings[] }
```

| Evaluation    | Cause                                                              | Vitest  | Report status |
| ------------- | ------------------------------------------------------------------ | ------- | ------------- |
| `evaluated`   | ran to completion; can still hold errors                           | ✅ / ❌ | passed/failed |
| `skipped`     | listed in `skipChecks`                                             | ⏭️      | incomplete    |
| `unsupported` | `wrangler.toml`, wrangler not installed, unknowable driver version | ⏭️      | incomplete    |
| `failed`      | no config, invalid JSONC, timeout, a check that throws             | ❌      | failed        |

Findings carry `check`, `severity`, `message`, `path`, the Cloudflare `docs` URL, and `evaluation` when evidence is missing.

## Checks

| Check                             | Fails when                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler-types-current`          | the project's own `wrangler types --check` exits non-zero                                                                                     |
| `no-secrets-in-vars`              | a `vars` name marks a secret (`API_KEY`, `dbPassword`, `SIGNING_KEY`) or a value looks like a credential (JWT, PEM, Stripe, GitHub…)          |
| `environment-bindings-redeclared` | a top-level non-inheritable key (bindings, `vars`, `define`, `secrets`) or one of its names is missing in an `env.<name>`                     |
| `compatibility-date-current`      | the date is missing, invalid, in the future, or too old; `nodejs_compat` is missing before 2026-08-04 (⚠️ redundant from it on)               |
| `observability-enabled`           | `observability.enabled` isn't `true` at the top level or in an environment that overrides it                                                  |
| `hyperdrive-contract`             | a `pg` / `postgres` / `mysql2` Worker lacks a binding, a supported driver, or Node.js compat; a committed password; PlanetScale's HTTP driver |

<details>
<summary>Per-check rules and limits</summary>

### wrangler-types-current

Resolves `node_modules/wrangler` from the config's directory up to `root`, then runs its JS entry with the current Node binary: `types --check --config <config>` plus `wranglerTypes.args`, no shell, so Windows `.cmd` shims never run. Timeout: `wranglerTypes.timeoutMs` (default 120 s; the Vitest test allows 125 s). Any non-zero exit is an error with Wrangler's output: regenerate with `wrangler types` and commit. Reads TOML too, because Wrangler parses the config.

### no-secrets-in-vars

- Names split on `_`, `-`, and camelCase. Secret words: `secret`, `token`, `password`, `passwd`, `pwd`, `passphrase`, `credential(s)`, and the pairs `api key`, `private key`, `access key`, `signing key`, `encryption key`, `auth key`.
- A name ending in a descriptor (`_URL`, `_HOST`, `_NAME`, `_HEADER`, `_TTL`, …) describes a secret instead of holding one and stays silent.
- Values: every string leaf is scanned, nested objects included, for URLs with a password and well-known token formats. No entropy heuristic. Values never appear in findings.
- `allowedVars` exempts reviewed names; their values are still scanned.

### environment-bindings-redeclared

Keys follow Wrangler's own validator (checked 2026-09-24), a superset of the [documented list](https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys): it adds `d1_databases`, `hyperdrive`, `ai`, `browser`, `analytics_engine_datasets`, and more. `unsafe*` keys are out. Empty top-level declarations are ignored. When both sides declare a key, top-level names must reappear: `vars` / `define` keys, `secrets.required`, binding names, queue producers and consumers. Wrangler only warns about this; the check fails.

### compatibility-date-current

`YYYY-MM-DD`, a real calendar day, not after today (UTC), at most `compatibilityDateMaxAgeDays` old (default 180). Environments are checked only when they override `compatibility_date` or `compatibility_flags`. `no_nodejs_compat` is an explicit opt-out and stays silent. Never bumps the date: a bump changes runtime behavior.

### observability-enabled

`observability` is inheritable, so an environment that omits it shares the top-level result. Traces are not required: they are in beta and billed separately.

### hyperdrive-contract

- Reads `dependencies`, `devDependencies`, and `optionalDependencies` from the `package.json` next to the config; none there → ⚠️ unsupported.
- Minimums: `pg` 8.16.3, `postgres` 3.4.5, `mysql2` 3.13.0 (Cloudflare pages last updated 2026-04-21). Version from the installed package, else the lower bound of a plain `^` / `~` / `>=` / exact range; anything else → ⚠️ unsupported.
- A binding anywhere (top level or any environment) satisfies the driver; per-environment coverage belongs to `environment-bindings-redeclared`.
- `localConnectionString` with a password → ❌ for a remote host, ⚠️ for loopback. Use `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>` instead.
- `@planetscale/database` next to a Hyperdrive binding → ❌: Cloudflare recommends a TCP driver behind Hyperdrive.
- Node.js compat is read from the top-level date and flags only.

### Which configs get read

Unset `wranglerConfigs`: the first of `wrangler.json`, `wrangler.jsonc`, `wrangler.toml` at the root, Wrangler's lookup order. Set it to one entry per Worker in a monorepo; paths outside the project or an empty list throw. **JSON/JSONC only**: this package carries no TOML parser, so a `wrangler.toml` is unsupported evidence for every check except `wrangler-types-current`. Migrating to `wrangler.jsonc` is Cloudflare's own recommendation.

</details>

## Options

| Option                        | Default                           | Used by                      |
| ----------------------------- | --------------------------------- | ---------------------------- |
| `root`                        | required                          | all                          |
| `wranglerConfigs`             | Wrangler's root lookup            | all                          |
| `skipChecks`                  | `[]` (unknown ids throw)          | all                          |
| `now`                         | system clock                      | `compatibility-date-current` |
| `compatibilityDateMaxAgeDays` | `180`                             | `compatibility-date-current` |
| `allowedVars`                 | `[]`                              | `no-secrets-in-vars`         |
| `wranglerTypes`               | `{ args: [], timeoutMs: 120000 }` | `wrangler-types-current`     |

Not checked, owned elsewhere: config schema and unknown keys (`$schema` + Wrangler), binding use in code (`tsc`), SQLite Durable Object classes (deploy fails), traces, pricing and limits.

## Sources

Independent implementations of Cloudflare's [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), the [Node.js compatibility default](https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/), and the Hyperdrive driver and local development guides, reviewed 2026-09-24. The non-inheritable key list follows the [workers-sdk validator](https://github.com/cloudflare/workers-sdk/blob/fc3cbaa4150a3cf30502286452153806bf8800d2/packages/workers-utils/src/config/validation.ts). Source carries greppable `@attribution` tags.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                        | Trigger or review scope                                                                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compatibility-date-current`      | compatibility_date is set, not in the future, within the configured age, and consistent with the nodejs_compat flag.                                                                                                    |
| `environment-bindings-redeclared` | Every named environment redeclares the non-inheritable keys (bindings, vars, define, secrets) present at the top level.                                                                                                 |
| `hyperdrive-contract`             | A Worker using pg, postgres, or mysql2 has a Hyperdrive binding, a supported driver version and Node.js compatibility; no committed localConnectionString password; no PlanetScale serverless driver behind Hyperdrive. |
| `no-secrets-in-vars`              | vars at the top level and in every environment hold no secret-named keys or credential-shaped values.                                                                                                                   |
| `observability-enabled`           | The Worker and every environment that overrides observability set observability.enabled to true.                                                                                                                        |
| `wrangler-types-current`          | The committed Wrangler-generated types match the current config (wrangler types --check).                                                                                                                               |

### Credited concepts

- https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/ (inspiration; independently implemented)
- https://developers.cloudflare.com/hyperdrive/configuration/local-development/ (inspiration; independently implemented)
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/mysql-database-providers/planetscale/ (inspiration; independently implemented)
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/mysql-drivers-and-libraries/mysql2/ (inspiration; independently implemented)
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/ (inspiration; independently implemented)
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/ (inspiration; independently implemented)
- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ (inspiration; independently implemented)
- https://developers.cloudflare.com/workers/configuration/compatibility-dates/ (inspiration; independently implemented)
- https://developers.cloudflare.com/workers/configuration/secrets/ (inspiration; independently implemented)
- https://developers.cloudflare.com/workers/languages/typescript/ (inspiration; independently implemented)
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/ (inspiration; independently implemented)
- https://developers.cloudflare.com/workers/wrangler/commands/workers/ (inspiration; independently implemented)
- https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys (inspiration; independently implemented)
- https://github.com/cloudflare/workers-sdk/blob/fc3cbaa4150a3cf30502286452153806bf8800d2/packages/workers-utils/src/config/validation.ts (Apache-2.0 OR MIT fact source; key list only, independently implemented)

<!-- harness-catalog:end -->
