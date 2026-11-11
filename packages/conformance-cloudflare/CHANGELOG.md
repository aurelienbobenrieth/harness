# @aurelienbbn/conformance-cloudflare

## 0.1.3

### Patch Changes

- [#99](https://github.com/aurelienbobenrieth/harness/pull/99) [`d46650d`](https://github.com/aurelienbobenrieth/harness/commit/d46650d2662b4a849cb8530218640c09e2c8c0a4) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Rewrite the README: claim headings in the promised order (install and first command before reference), install commands where they were missing, and rule and preset counts corrected against the registered exports.

## 0.1.2

### Patch Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - `compatibility-date-current` reports a date older than `compatibilityDateMaxAgeDays` (default 180 days) as a warning instead of a failure: an old date is a maintenance nudge, not a broken config. It also reports a missing `nodejs_compat` on a pre-2026-08-04 date as a warning: 18 of 18 Cloudflare templates in that state import no `node:` module, and whether the flag is needed depends on the Worker's dependencies. The README states that the package reads wrangler configs and does not apply to Alchemy-declared Workers.

## 0.1.1

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 6 checks for Cloudflare Workers repos: current Wrangler types, no secrets in vars, bindings redeclared per environment, a fresh compatibility date, logs on, and a sound Hyperdrive setup.
