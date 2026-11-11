# @aurelienbbn/agentlint-plugin-effect

[![npm](https://img.shields.io/npm/v/@aurelienbbn/agentlint-plugin-effect)](https://www.npmjs.com/package/@aurelienbbn/agentlint-plugin-effect) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/agentlint-plugin-effect)](https://www.npmjs.com/package/@aurelienbbn/agentlint-plugin-effect) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/agentlint-plugin-effect)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/agentlint-plugin-effect/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/agentlint-plugin-effect)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/agentlint-plugin-effect/package.json)

**3 agentlint reviews for Effect: a database transaction never waits on the network, a conversion keeps the failure it replaces, and a refusal's reason reaches who was refused.**

> [!WARNING]
> Requires the engine `@aurelienbbn/agentlint` `>=0.3.0 <0.10.0` as a peer. [Evidence](../../docs/compatibility.md#agentlint-engine).

## Quick start

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-effect#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` keeps an existing config and prints the install command; never installs.

## Rules

| Rule                            | `strictPreset` | `starterPreset` | Authority | Standard rev | Detector |
| ------------------------------- | :------------: | :-------------: | --------- | :----------: | :------: |
| `transaction-no-network`        |       ✅       |       ✅        | agent     |      1       |    1     |
| `conversion-keeps-failure`      |       ✅       |       ✅        | agent     |      1       |    1     |
| `refusal-reason-reaches-reader` |       ✅       |       ✅        | agent     |      1       |    1     |

Presets ignore `**/*.d.ts`. The rules skip test, fixture and `testing` files.

```ts
yield *
  sql.withTransaction(
    Effect.gen(function* () {
      yield* save(order);
      yield* Mailer.use((m) => m.send(receipt));
    }),
  ); // ❌ the send holds the transaction open
yield * sql.withTransaction(save(order)); // ✅ commit first
yield * Mailer.use((m) => m.send(receipt)); //    then call
```

### `transaction-no-network`

A lexical rule cannot tell that `notify()` three files away ends in `fetch`. This one follows what a transaction's work references through the checkout: relative imports (`.js` suffixes, index files, `export *`, namespace members) inside the same workspace member (the nearest folder with a `package.json`), skipping test code. It reads at most 400 declarations per transaction and stops at the first four network sinks.

- **Transactions:** `withTransaction(effect)` and `effect.pipe(…, sql.withTransaction)` (Effect SQL), `db.transaction(fn)` (Drizzle, Knex, TypeORM), `prisma.$transaction(fn)`, `db.transaction().execute(fn)` (Kysely). Only the steps piped into the opener are inside it.
- **Network sinks:** global `fetch` and `globalThis.fetch`; an Effect `HttpClient` (`effect/unstable/http`, `@effect/platform*`); `axios`, `got`, `ky`, `undici`, `node-fetch`, `node:http(s)`, `ofetch`, `superagent`; common provider SDKs (`stripe`, `resend`, `@slack/*`, `@aws-sdk/client-*`, …); and **services whose layer reaches one**. A reached service class (`Context.Service`, `Context.Tag`, `GenericTag`) counts when a non-test `Layer.*(Service, …)` call in its member reaches a sink, so an in-memory adapter stays silent and no folder convention is needed.
- **Project wiring:** `defineTransactionNoNetwork({ … })` takes `openers` (extra `name(work)`), `curriedOpeners` (`name(scope)(work)`), `networkModules` (import specifiers or repository path prefixes) and `networkServices` (names), for what cannot be inferred from the code.

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { defineTransactionNoNetwork } from "@aurelienbbn/agentlint-plugin-effect";

export default defineConfig({
  rules: [
    defineTransactionNoNetwork({
      openers: ["atomically"],
      curriedOpeners: ["inTenant", "withTenant"],
      networkServices: ["Slack"],
    }),
  ],
});
```

Limits: names, not types. A callback passed in as a parameter, a method on an object built elsewhere, a dynamic import and a service whose layer lives in another workspace member are not followed (name the service in `networkServices`). The finding's evidence carries a digest of every declaration on the path, so an acceptance reopens when a reached file changes while the path still ends at the network; if the path no longer reaches the network the finding disappears. Parsing uses `oxc-parser` (syntax only, no type checker), read lazily: a file is parsed only when its text names an opener.

### `conversion-keeps-failure`

`Effect.mapError(() => UpstreamUnavailableError.make({}))` is often exactly right for the client and fatal for whoever debugs the outage: the store's failure is gone, and nothing says why the empty error happened. The rule points at handlers that replace a failure without reading it, so an agent can decide whether something worth keeping was lost.

```ts
store.read().pipe(Effect.mapError(() => UnavailableError.make({}))); // ❌ the outage leaves no trace
store.read().pipe(
  Effect.tapError((failure) => Effect.logError("read failed", failure)), // ✅ opaque for the client, on record for us
  Effect.mapError(() => UnavailableError.make({})),
);
```

- **Reports:** `mapError`, `orElseFail`, `catch`/`catchAll` answering with a new failure, and the `catch` of `Effect.try`/`tryPromise`, on `Effect`, `Stream`, `Layer`, `Micro`, `STM`, `Channel` and `Sink`, when the handler has no parameter or never reads it.
- **Stays silent:** a handler that reads the failure, a named mapper, an effect that only says a value was absent (`fromOption`, `fromNullishOr`, `fromNullable`), input that did not decode (a source named `decode…`), and a failure a `tapError`, `tapErrorCause`, `tapErrorTag`, `tapCause` or `onError` step saw first.
- **Passes review:** a failure that holds nothing beyond its type, or one dropped on purpose (a secret, personal data, what a caller must not learn). Say why when accepting.

Limits: one file, names, not types. `Effect.catchTag` and `catchTags` handlers are not read: most translate one domain error into another. A log inside the converted effect is invisible here, which is why the agent checks before concluding.

### `refusal-reason-reaches-reader`

A server that answers `reason: "inactive"` has done the work. If the page then shows "Could not save. Retry." for every failure, the user retries a refusal that will refuse again. This rule looks for reasons sent over the wire that nothing reads.

```ts
class SetupRefusedError extends Schema.TaggedError<SetupRefusedError>()("SetupRefusedError", {
  reason: Schema.Literals(["inactive", "not_allowed"]),
}) {} // ❌ on an Rpc, and no file tells it apart

const REFUSALS: Record<SetupRefusedError["reason"], () => string> = {
  inactive: m.setup_refused_inactive, // ✅ one text per reason, kept complete by TypeScript
  not_allowed: m.setup_refused_not_allowed,
};
```

- **Reports:** a tagged error with a `reason` field, declared in `Rpc.make(…, { error })` or `.addError(X)`, that no runtime file in the checkout tells apart: `Schema.is(X)`, `X["reason"]`, `instanceof X`, the tag written out, or an `X:` handler key. Tests and comments do not count.
- **Stays silent:** an error with a `message` field or member (the text travels with it), and a checkout where no wire error is read at all (its clients live elsewhere).
- **Passes review:** a reason only a stale view can reach when the generic text sends the user to refresh, or a caller that is a program.

Limits: it reads the whole checkout across workspace members, once per run, and matches names, not types. It answers whether an error is read, not whether each reason has a text: `Record<X["reason"], …>` already makes TypeScript check that, and a client printing the raw code counts as reading it.

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

| Rule/check                      | Trigger or review scope                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `conversion-keeps-failure`      | Flags a mapError, catch or tryPromise handler that replaces a failure without reading it, so an outage does not leave only an empty error behind.                              |
| `refusal-reason-reaches-reader` | Flags an RPC or HTTP API error carrying a reason that no code in the checkout reads, so a refusal the user could act on does not end as a generic failure.                     |
| `transaction-no-network`        | Flags a database transaction whose work reaches a network call (fetch, an HTTP client, a service whose layer calls one) so the call moves before it opens or after it commits. |

<!-- harness-catalog:end -->

## Credits

`starterPreset` onboarding: conceptual inspiration from desloppify by Peter O'Malley; no code or guidance copied.
