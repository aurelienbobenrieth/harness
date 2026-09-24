# @aurelienbbn/agentlint-plugin-core

**24 agentlint reviews for any TypeScript repo: a deterministic trigger finds the spot, an agent or a human settles it.**

> [!WARNING]
> **Private draft.** Built against the reviewed archive `local-packages/agentlint-current.tgz`; public agentlint 0.1.5 is API-incompatible. [Evidence](../../docs/compatibility.md#private-draft-boundary).

```text
strictPreset   ████████████             12  settled rules
starterPreset  ██                        2  boundary-resilience, bounded-work
opt-in         ████████████             12  exported, in no preset: calibrate first
```

## Start with 2 rules, not 24

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-core#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` keeps an existing config and prints the install command; never installs. **Calibrate bindings before requiring `agentlint check --all`.**

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { defineFallbackMasksFailure, fakeParity, strictPreset } from "@aurelienbbn/agentlint-plugin-core";

export default defineConfig({
  extends: [strictPreset],
  rules: [fakeParity, defineFallbackMasksFailure({ minFallbacksPerScope: 3 })],
});
```

## Rules

| Rule                                 | Preset           | Authority | Lifecycle | Options (default)                                                                           |
| ------------------------------------ | ---------------- | --------- | --------- | ------------------------------------------------------------------------------------------- |
| `abstraction-earns-keep`             | strict           | 🔒 human  | state     | `minForwardingMembers` (3), `forwardingRatio` (0.8), `interfacePattern`                     |
| `boundary-resilience`                | strict · starter | agent     | state     | `networkCallPattern`                                                                        |
| `bounded-data-access`                | strict           | agent     | state     |                                                                                             |
| `bounded-work`                       | strict · starter | agent     | state     |                                                                                             |
| `comment-signal`                     | strict           | agent     | state     | `narrationPattern`, `minWordOverlapLength` (4)                                              |
| `correlated-optional-state`          | strict           | agent     | state     | `discriminantNames`, `minOptionalSiblings` (2), `skipNamePattern`                           |
| `expected-value-recomputed`          | strict           | agent     | state     | `matcherPattern`, `derivationCallees`, `maxFindingsPerFile` (3)                             |
| `integration-test-owns-its-boundary` | strict           | agent     | state     | `integrationPattern`, `doublePattern`                                                       |
| `temporal-coupling`                  | strict           | agent     | state     | `guardMessagePattern`, `initMethodPattern`                                                  |
| `test-behavior-coverage`             | strict           | agent     | state     | `mockPattern`, `outcomePattern`, `minInteractionShare` (0.5), `maxInlineSnapshotLines` (12) |
| `test-exercises-project-code`        | strict           | agent     | state     | `projectImportPattern`, `workspacePackages`, `blackBoxModules`                              |
| `test-expectation-drift`             | strict           | 🔒 human  | change    | `authority`, `testFilePattern`, `assertionPattern`, `maxEvidenceLines`                      |
| `change-scatter-review`              | 🧪               | 🔒 human  | change    | `minFiles` (3), `maxFindings` (3), `tokenPattern`                                           |
| `fake-parity`                        | 🧪               | agent     | state     | `fakeNamePattern`, `portTypePattern`                                                        |
| `fallback-masks-failure`             | 🧪               | agent     | state     | `minFallbacksPerScope` (2), `sensitiveNames`                                                |
| `flag-forked-function`               | 🧪               | 🔒 human  | state     | `minFlags` (2), `minSitesForSingleFlag` (3), `includeJsx` (false)                           |
| `hotspot-change-review`              | 🧪               | 🔒 human  | change    | `hotspots` (empty: silent)                                                                  |
| `isomorphic-mapping`                 | 🧪               | 🔒 human  | state     | `minProperties` (5), `identityRatio` (0.9)                                                  |
| `pinned-suspect-output`              | 🧪               | agent     | state     | `suspectPattern`                                                                            |
| `precision-boundary-review`          | 🧪               | 🔒 human  | state     | `conversionCalleePattern`                                                                   |
| `property-test-opportunity`          | 🧪               | agent     | state     | `pairPatterns`, `idempotentPattern`, `propertyApiPattern`                                   |
| `protected-invariant-change`         | 🧪               | 🔒 human  | change    | `invariants` (empty: silent)                                                                |
| `single-use-extraction-review`       | 🧪               | 🔒 human  | state     | `minParameters` (2), `minStatements` (3)                                                    |
| `validation-discards-proof`          | 🧪               | agent     | state     | `namePattern`                                                                               |

🧪 opt-in: exported, register it yourself · 🔒 only a human can accept a finding. Presets ignore `**/*.d.ts`.

**Promote an opt-in rule only when most of its `agentlint rules scan --review` findings lead to a change.** Each prescribes a fix that is expensive or of unknown volume.

```ts
fetch(url);                                                          // ❌ boundary-resilience: no signal/timeout
fetch(url, { signal: AbortSignal.timeout(2_000) });                  // ✅
try { await fetch(url, { signal }); } catch (error) { logger.warn('failed', error); }  // ❌ failure discarded (logging still discards)

expect(applyDiscount(price, pct)).toBe(price - (price * pct) / 100); // ❌ expected-value-recomputed
expect(applyDiscount(200, 15)).toBe(170);                            // ✅ states it

const email = form.get("email") || "";                               // ❌ fallback-masks-failure
<span title={user.email ?? ""}>{user.id ?? ""}</span>               // ✅ JSX display default
```

**A network `try/catch` returning an empty literal is reported by both `fallback-masks-failure` and `boundary-resilience`.**

<details>
<summary>Boundaries: <code>boundary-resilience</code>, <code>bounded-work</code>, <code>bounded-data-access</code></summary>

| Rule                  | Fires on                                                                                                                                                   | Stays silent                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boundary-resilience` | `fetch(` / `axios` / `got` / `ky` call whose **argument list** has no `signal`, `timeout`, `timeoutMs`, `deadline` or `AbortSignal`                        | chained `fetch(url).then(...)` reports once, on the call owning the args; strings and comments are blanked (`fetch("/api/signal?timeout=1")` fires) |
|                       | `catch` of a `try` around an outbound call, or `.catch(cb)` on one, that discards the failure (handing it only to `console.*` / `logger.*` still discards) | rethrow, branching on the error, passing it to another function, a `REASON:` comment of ≥ 3 words; catches around anything else                     |
| `bounded-work`        | ≥ 3 sequential `await`s with I/O, looped I/O, `Promise.all(...map(...))` fan-out, `timeoutMs`/`durationMs`/`cpuMs` > 60 000                                | a pure `items.map(item => item.id)`                                                                                                                 |
| `bounded-data-access` | `findMany`/`findAll`/`getMany`/`list`/`search`/`query`/`select` on a repo/store/dao/client/model/collection                                                | a non-zero `first`/`take`/`limit`/`pageSize`/`perPage`/`maxResults` or `.limit(n)`/`.take(n)`                                                       |

Limits: `bounded-work` separates enclosing operations; a cursor alone is not a cardinality bound; cancellation is not a deadline.

</details>

<details>
<summary>Tests: behaviour coverage, recomputed expectations, integration boundaries, project imports</summary>

| Rule                                 | Fires on                                                                                      | Stays silent                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `test-behavior-coverage`             | 3 triggers, distinct keys (below)                                                             | value, error, property, snapshot matchers count as outcomes                                   |
| `expected-value-recomputed`          | `expect(subject(...)).toBe…(expected)` where `expected` is computed from the subject's inputs | `60 * 60 * 1000`, URLs from unrelated constants, `expect.*`, `fc.property` / `it.prop` bodies |
| `integration-test-owns-its-boundary` | an `integration` / `e2e` test that constructs doubles                                         | `print.test.ts`, contract suites (`int`, `contract` are not markers)                          |
| `test-exercises-project-code`        | a test file with an `it`/`test` that imports nothing from the project                         | black-box drivers; `*.test-d.ts`                                                              |

```text
test-behavior-coverage triggers
file-density      ≥ 3 mock constructions, no assertion pins returned state or output
interaction-only  ≥ 2 tests, or ≥ minInteractionShare of a file's tests, assert interactions only
                  (skipped when file-density already fires; lists the doubles per test)
snapshot-only     ≥ 2 tests whose only oracle is a whole-value snapshot,
                  or an inline snapshot > maxInlineSnapshotLines
```

`toHaveBeenCalled*`, `toHaveBeenNthCalledWith`, `toHaveReturned*` and the `toBeCalled*` aliases never count as outcomes, even through a custom `outcomePattern`. The judge asks, per double, whether the mocked collaborator is an unmanaged process boundary. Choosing the double and oracle stays in the `testing` skill. Limit: measures mock/assertion density per file, not per-test coverage.

**expected-value-recomputed.** Test files only. Matchers: `toBe`, `toEqual`, `toStrictEqual`, `toBeCloseTo`, `toContain`, `toMatchObject`. `expected` (or the local `const` it names, inside the same test callback) is computed when it is arithmetic with a non-literal operand, a `map`/`filter`/`reduce`/`join`/`replace`/`toLowerCase`/`toFixed`/`round`… call, or a template with ≥ 2 substitutions. Reports only when the expected expression shares an identifier with the subject call's arguments, or calls something imported from the subject's own module.

**integration-test-owns-its-boundary.** Path has an `integration` or `e2e` segment or name part (`orders.integration.test.ts`, `tests/integration/...`, `e2e/...`), or the first `describe` title contains "integration". Doubles: `vi.fn(`, `createMock(`, `mockX(`, `fakeX(`, or an `InMemoryX`/`FakeX`/`StubX` name. Strings and comments are ignored; the doubles are the evidence. One finding per file. A contract suite legitimately runs the fake next to the real thing.

**test-exercises-project-code.** Project-reaching specifiers: relative, `@/`, `~/`, `#...`, or a name in `workspacePackages`, through `import`, `export ... from`, `import()`, `require()` or `vi.importActual()`. Black-box drivers that keep it silent: `node:child_process`, `execa`, `node:fs`, `node:fs/promises`, `@playwright/test`, `supertest`, `undici`, or a bare `fetch(` call. A monorepo importing itself by package name lists those names in `workspacePackages`.

</details>

## 🔒 Test drift: the author doesn't accept it

**`test-expectation-drift` authority defaults to `"human"`: the change author is the party tempted to accept a finding about it.** `defineTestExpectationDrift({ authority: "agent" })` restores the usual default. Don't narrow `include` to test files: the engine filters the change by the binding before detection, and two kinds depend on source edits.

<details>
<summary>The 6 drift kinds (one finding per test or <code>*.snap</code> file)</summary>

| Kind                   | Fires when                                                                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assertion-removed`    | more assertion lines deleted than added; a line reappearing verbatim anywhere in the change is a move and leaves both sides first                                                                                                                                    |
| `test-removed`         | more `it(`/`test(` lines deleted than added, or a test file deleted while no source file with the same stem is deleted or renamed                                                                                                                                    |
| `matcher-downgraded`   | same `expect(subject)` steps down `toStrictEqual` › `toEqual`/`toBe` › `toMatchObject` › `toHaveProperty`/`toContain`/`toBeDefined`/`toBeTruthy`, `toBe` › `toBeCloseTo`, or gains `expect.any`/`expect.anything`/`expect.objectContaining`/`expect.arrayContaining` |
| `expectation-revalued` | same subject, same matcher, different argument, **and** a non-test source file changed                                                                                                                                                                               |
| `disabled`             | `.skip`, `.todo`, `.fails` or `xit`/`xtest`/`xdescribe` added                                                                                                                                                                                                        |
| `snapshot-rewritten`   | lines deleted from a `.snap` file or a multi-line `toMatchInlineSnapshot` body while source changed                                                                                                                                                                  |

Silent: added test files, additions-only hunks, stronger matchers, a test deleted with its source. The only change-lifecycle rule in the settled set.

</details>

<details>
<summary>Design: <code>abstraction-earns-keep</code>, <code>correlated-optional-state</code>, <code>temporal-coupling</code>, <code>comment-signal</code></summary>

| Rule                        | Fires on                                                                                                                                                                                                                                                                                                                                               | Stays silent                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `abstraction-earns-keep`    | behaviour-only interface/type equal to its only in-file implementer (class, `satisfies`, annotated object); `Impl`/`Default`/`Base`/`Concrete`/`Standard`/`Real` affix on an implementation of a relatively imported interface; a class forwarding verbatim to one collaborator; a module whose exports all forward (replaces its per-export findings) | name-based matching unless `interfacePattern` is set; name matches when the file shows ≥ 2 implementers                                     |
| `correlated-optional-state` | non-test interface/object type with a required `status`/`state`/`kind`/`type`/`phase`/`step`/`mode`/`variant` string-literal union + ≥ 2 optional or `\| null`/`\| undefined` fields                                                                                                                                                                   | `*Props`, `*Options`, `*Config`, `*Params`, `*Args`, `*Input`, `*Query`, `*Filter`, `*Patch`, `*Update`; members of a union or intersection |
| `temporal-coupling`         | a non-test class usable before setup, one finding per class (signals below)                                                                                                                                                                                                                                                                            | decorated framework fields (`@property() name!: string`), `!` fields the constructor assigns, "User not found"                              |
| `comment-signal`            | a `//` comment starting with create/get/set/return/initialize/loop/check/call/update/send/add/remove that shares a word with the next line; docblocks restating the signature                                                                                                                                                                          | units, invariants, useful public-interface docs, even short; JS type-only JSDoc tags                                                        |

```text
temporal-coupling signals
guard-throw          throw message says "not initialized/connected/started/configured/ready/loaded/opened",
                     "call x() first/before" or "must call/be initialized"
definite-assignment  undecorated `name!: T` assigned in a method, never in the constructor
nullable-init        `| null`/`| undefined` field set by exactly one init/initialize/setup/connect/open/
                     start/load/configure/bootstrap method, null-checked in ≥ 2 other methods
```

Factory closures aren't inspected yet. Bags of lifecycle booleans belong to `no-impossible-state-bag` in the type-evidence oxlint plugin.

**abstraction-earns-keep** counts implementers instead of reading names. Recommended `interfacePattern`: `/^I[A-Z][a-z]|Interface$/`, which keeps `IPAddress` silent. The single-file view sees ports-and-adapters only through the affix trigger, so the judge searches the repo for a second implementer or a test double before failing a finding. An abstraction that makes today's change easier passes even with one implementer.

**comment-signal docblock bar**, from conventions observed in upstream `effect-ts/effect` sources (`Array.ts`, `Option.ts`, `Duration.ts`):

| Keep                                                       | Drop                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `@since`, `@category`, `@example`, `@see`                  | `@param` / `@returns`: types live in the signature, never restated  |
| structured prose: "When to use", "Details"                 | a parameter list restated in ≤ 3 words per entry (review candidate) |
| edge cases: NaN treated as 0, clamping to `[0, length]`    |                                                                     |
| units and precision: rounding to the nearest nanosecond    |                                                                     |
| invariants: inclusive bounds, singleton instances; gotchas |                                                                     |

JavaScript type-only JSDoc tags stay valid: they carry compile-time type information.

</details>

<details>
<summary><code>fallback-masks-failure</code> 🧪: triggers and "required data"</summary>

Measure its volume on your code before enforcing. One finding per function at most; default binding excludes test files.

| Fires on                                                                                              | Detail                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `??` / `\|\|` with an empty literal on the right                                                      | `""`, ` `` `, `0`, `[]`, `{}`, `"unknown"`, `"N/A"`, when the left side names required data |
| ≥ `minFallbacksPerScope` (2) fallbacks on ordinary names in one function                              |                                                                                             |
| parameter or destructuring default with an empty literal                                              | required-looking names only                                                                 |
| `catch` / `.catch(cb)` whose every return is empty, `null` or `undefined` and that discards the error | same definition as `boundary-resilience`, `REASON:` escape included                         |

"Required data" = the trailing property, string key (`form.get("email")`, `headers["x-api-token"]`) or callee, split into segments and matched against `sensitiveNames` (default: id, key, token, secret, price, amount, total, cost, fee, tax, balance, quantity, count, currency, url, email, sku, …). `width` does not match `id`. Fallbacks the type checker proves useless belong to `typescript/no-unnecessary-condition`.

</details>

<details>
<summary>Other opt-in rules: what the catalog line doesn't say</summary>

| Rule                           | Extra                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `validation-discards-proof`    | complements `fallback-masks-failure`: that one reports the default papering over absence, this one where the proof should have been produced |
| `precision-boundary-review`    | named conversion calls stay silent                                                                                                           |
| `single-use-extraction-review` | asks whether the helper names a concept or fragments one operation                                                                           |
| `change-scatter-review`        | find one invariant owner, or justify independent boundary translations                                                                       |
| `hotspot-change-review`        | paths backed by concrete correction, rollback, incident or co-change history; generic complexity scores are not hotspots                     |

</details>

## Declared invariants and hotspots

**`protected-invariant-change` and `hotspot-change-review` ship empty and stay silent:** they fire only on what your repo declares.

| Factory                          | Each entry                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `defineProtectedInvariantChange` | `invariants[]`: `id`, `statement` (falsifiable against the change), `protectedPaths: RegExp[]`, `evidencePaths?: RegExp[]` |
| `defineHotspotChangeReview`      | `hotspots[]`: `id`, `pathPattern: RegExp` (backed by real history), `evidence` (the concrete reason)                       |

## Migration: re-review earlier acceptances

**Review prompts, not correctness proofs.**

| Rule                                                                   | Rev | Detector | Change                                                                                                        |
| ---------------------------------------------------------------------- | :-: | :------: | ------------------------------------------------------------------------------------------------------------- |
| `boundary-resilience` ⚠️                                               |  2  |    2     | reports discarding handlers around outbound calls; resilience words outside the argument list no longer count |
| `test-behavior-coverage` ⚠️                                            |  3  |    3     | reports interaction-matcher-only files, interaction-only tests, snapshot-only tests                           |
| `abstraction-earns-keep` ⚠️                                            |  2  |    2     | counts implementers and forwarding members; `IName` / `...Interface` names only with `interfacePattern`       |
| `abstraction-earns-keep`, `flag-forked-function`, `isomorphic-mapping` |     |          | architectural tradeoffs: now 🔒 human authority                                                               |
| `flag-forked-function`                                                 |     |          | skips JSX files unless `includeJsx`                                                                           |

⚠️ existing acceptances need a fresh review.

<details>
<summary>Agentlint rule contract</summary>

| Fact                | Detail                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rule shape          | `lifecycle`, `standard` (revision), `detector` (version), `binding` (id, authority, scope, material options)                                                                |
| composing           | `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`; repeated uses need distinct binding ids                                               |
| authority           | repository owners choose scope and authority; mechanically evidenced rules may permit agent acceptance; architectural, invariant and irreversible tradeoffs require a human |
| accepting a finding | requires matching current evidence **and** matching authority                                                                                                               |
| fixtures            | `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser                                                                         |

</details>

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                           | Trigger or review scope                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `abstraction-earns-keep`             | Flags interfaces that mirror their only implementer, classes and modules that forward verbatim to one collaborator, and exports that only delegate to a single call.                 |
| `boundary-resilience`                | Flags outbound network calls that show no timeout or AbortSignal, and handlers around them that discard the failure.                                                                 |
| `bounded-data-access`                | Flags repository-like list/search/query calls without obvious boundedness markers.                                                                                                   |
| `bounded-work`                       | Flags execution paths with unbounded I/O, fan-out, or runtime budgets.                                                                                                               |
| `change-scatter-review`              | Flags a decision token added across several production files so a reader checks whether the change is legitimately cross-cutting or duplicates ownership.                            |
| `comment-signal`                     | Flags comments that narrate the next line or docblocks that restate the signature.                                                                                                   |
| `correlated-optional-state`          | Flags object types that pair a literal-union status field with two or more optional fields, where a discriminated union would make illegal combinations unrepresentable.             |
| `expected-value-recomputed`          | Flags assertions whose expected value is computed from the same inputs as the call under test instead of being stated.                                                               |
| `fake-parity`                        | Flags hand-written stateful fakes of a port so a shared behaviour suite or contract test proves they still behave like the real implementation.                                      |
| `fallback-masks-failure`             | Flags empty-literal fallbacks on required-looking values, fallback-dense functions, and error handlers that return an empty literal.                                                 |
| `flag-forked-function`               | Flags functions whose boolean or literal-union parameters are used only to choose between code paths, to check whether they are two functions sharing a name.                        |
| `hotspot-change-review`              | Flags changes to paths a repository has identified from real corrective history instead of treating generic complexity scores as defects.                                            |
| `integration-test-owns-its-boundary` | Flags test files named or titled as integration tests that also construct test doubles, so the claimed boundary is checked to be real.                                               |
| `isomorphic-mapping`                 | Flags functions that copy an object field by field into a same-shaped object, to check that a real boundary separates the two types.                                                 |
| `pinned-suspect-output`              | Flags expected strings and inline snapshots that contain `undefined`, `NaN`, `[object Object]`, `Invalid Date` or an embedded `null`, which usually certify a bug the test recorded. |
| `precision-boundary-review`          | Flags raw arithmetic across different unit-bearing identifiers so a reader checks units, tolerances, rounding and independent test evidence.                                         |
| `property-test-opportunity`          | Flags test files that cover an encode/decode-style inverse pair or an idempotent normaliser with examples only, where one property would cover the open input domain.                |
| `protected-invariant-change`         | Flags changes to repository-declared invariant surfaces and their supporting evidence so architectural guarantees cannot change silently.                                            |
| `single-use-extraction-review`       | Flags substantial file-local helpers with one caller and several forwarded values so a reader decides whether the extraction names a real concept or fragments one operation.        |
| `temporal-coupling`                  | Flags classes that can exist in an unusable state: 'not initialized' guards, definite-assignment fields set outside the constructor, and nullable fields filled by an init method.   |
| `test-behavior-coverage`             | Flags mock-dense test files without an outcome assertion, tests that assert mock interactions only, and tests whose only oracle is a snapshot of a whole value.                      |
| `test-exercises-project-code`        | Flags test files that import nothing from the project, so the code they exercise is a copy or a third-party library.                                                                 |
| `test-expectation-drift`             | Flags test files whose existing expectations were deleted, loosened, skipped or re-valued in the same change, so the behaviour change is declared rather than absorbed.              |
| `validation-discards-proof`          | Flags validate/check/ensure functions that return void or boolean without a type predicate, so what they proved is lost to the type system.                                          |

### Credited concepts

- "Characterization Testing" by Michael Feathers (concept)
- "Choosing properties for property-based testing" by Scott Wlaschin (concept: inverse and idempotence families)
- "ContractTest" by Martin Fowler (concept)
- "Design Smell: Temporal Coupling" by Mark Seemann (concept)
- "Designing with types: Making illegal states unrepresentable" by Scott Wlaschin (concept)
- "Don't Put Logic in Tests" (Google Testing Blog) (concept)
- "FlagArgument" by Martin Fowler (concept)
- "Getting Started with Contract Tests" by J. B. Rainsberger (concept)
- "IntegrationTest" by Martin Fowler (concept: narrow integration tests double the remote, not the adapter)
- "Interfaces are not abstractions" by Mark Seemann (concept: header interfaces, Reused Abstractions Principle)
- "Parse, don't validate" by Alexis King (concept)
- "Parse, don't validate" by Alexis King (concept: absence is rejected once, at the boundary)
- "The Wrong Abstraction" by Sandi Metz (concept)
- "When to Mock" by Vladimir Khorikov (concept: interaction assertions belong to unmanaged process boundaries)
- ImpossibleBench (arXiv 2510.20270) (concept: passing by editing the oracle)
- code-slop by asyrafhussin (MIT) + thermos by Cursor (MIT), concepts re-implemented
- code-slop by asyrafhussin (MIT, concept re-implemented)
- code-slop by asyrafhussin (MIT, concept re-implemented; real-defenses checklist)
- https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/ (inspiration; independently implemented)
- https://alexn.org/blog/2026/09/22/ai-has-no-wisdom-and-neither-will-you/#isso-thread (inspiration; independently implemented)

<!-- harness-catalog:end -->

<details>
<summary>Credits, per rule</summary>

Concepts only; every rule is independently implemented.

| Rule                                                                                                                                        | Concept                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fallback-masks-failure`                                                                                                                    | "Parse, don't validate", Alexis King: absence is rejected once, at the boundary                                                                         |
| `validation-discards-proof`                                                                                                                 | "Parse, don't validate", Alexis King                                                                                                                    |
| `test-behavior-coverage`                                                                                                                    | "When to Mock", Vladimir Khorikov: interaction assertions belong to unmanaged out-of-process dependencies                                               |
| `test-expectation-drift`                                                                                                                    | ImpossibleBench (arXiv 2510.20270): passing by editing the oracle; "Characterization Testing", Michael Feathers                                         |
| `expected-value-recomputed`                                                                                                                 | "Don't Put Logic in Tests", Google Testing Blog                                                                                                         |
| `integration-test-owns-its-boundary`                                                                                                        | "IntegrationTest", Martin Fowler: narrow integration tests double the remote, not the adapter                                                           |
| `correlated-optional-state`                                                                                                                 | "Designing with types: Making illegal states unrepresentable", Scott Wlaschin                                                                           |
| `abstraction-earns-keep`                                                                                                                    | "Interfaces are not abstractions", Mark Seemann: header interfaces with one implementer                                                                 |
| `temporal-coupling`                                                                                                                         | "Design Smell: Temporal Coupling", Mark Seemann                                                                                                         |
| `flag-forked-function`                                                                                                                      | "The Wrong Abstraction", Sandi Metz; "FlagArgument", Martin Fowler                                                                                      |
| `property-test-opportunity`                                                                                                                 | "Choosing properties for property-based testing", Scott Wlaschin: inverse and idempotence families                                                      |
| `fake-parity`                                                                                                                               | "ContractTest", Martin Fowler; "Getting Started with Contract Tests", J. B. Rainsberger                                                                 |
| `single-use-extraction-review`, `change-scatter-review`, `precision-boundary-review`, `protected-invariant-change`, `hotspot-change-review` | "AI Has No Wisdom and Neither Will You", Alexandru Nedelcu: delayed maintainability feedback, fragmented single-use helpers, explicit design invariants |
| `comment-signal` docblock bar                                                                                                               | conventions observed in upstream `effect-ts/effect` sources                                                                                             |
| `starterPreset` onboarding                                                                                                                  | desloppify by Peter O'Malley: gradual onboarding; no code or guidance copied                                                                            |

</details>
