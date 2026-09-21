# @aurelienbbn/agentlint-plugin-core

Private draft. Development links to the sibling agentlint workspace; packed evidence uses the reviewed local archive; public agentlint 0.1.5 exposes an incompatible API. See the [compatibility evidence](../../docs/compatibility.md#private-draft-boundary).

Custom agentlint rules for general TypeScript projects.

## Presets

- `strictPreset`: enables every settled core rule in this package. Opt-in rules stay out: `fallbackMasksFailure`, `fakeParity`, `flagForkedFunction`, `isomorphicMapping`, `pinnedSuspectOutput`, `propertyTestOpportunity`, `validationDiscardsProof`.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

### comment-signal: docblock standard (Effect-style)

The "good docblock" bar in this rule's guidance follows the conventions observed in upstream `effect-ts/effect` sources (`Array.ts`, `Option.ts`, `Duration.ts`):

- Tags are `@since`, `@category`, `@example`, `@see`; `@param`/`@returns` are essentially absent — types live in the signature and are never restated.
- Prose is structured ("When to use", "Details") and adds what the signature cannot: edge cases (NaN treated as 0, clamping to `[0, length]`), units and precision (rounding to the nearest nanosecond), invariants (inclusive bounds, singleton instances), and gotchas.

A docblock that restates the parameter list in ≤3 words per entry carries none of that signal, is a review candidate. JavaScript type-only JSDoc tags remain valid because they carry compile-time type information.

### boundary-resilience: two triggers, one boundary

The rule fires on an outbound call (`fetch(`, `axios`, `got`, `ky`, or `networkCallPattern`) whose arguments carry no `signal`, `timeout`, `timeoutMs`, `deadline` key or `AbortSignal`. Only the argument list counts, with strings and comments blanked: a URL such as `/api/signal?timeout=1` or a nearby `timeout` variable no longer satisfies it. A chained call (`fetch(url).then(...)`) is reported once, on the call that owns the arguments.

It also fires on the `catch` clause of a `try` that contains an outbound call, and on a `.catch(callback)` chained to one, when the handler discards the failure: no `throw`, the caught binding absent or passed only to `console.*`/`logger.*`, and no `REASON:` comment of at least three words. Rethrowing, branching on the error, handing it to another function, or a written reason keeps it silent. Catch blocks around anything else are out of scope.

### test-behavior-coverage: interaction matchers are not outcomes

A test file with three or more mock constructions is reported when no assertion pins returned state or output. `toHaveBeenCalled*`, `toHaveBeenNthCalledWith`, `toHaveReturned*` and their `toBeCalled*` aliases never clear the trigger, even through a custom `outcomePattern`; the finding then says the file asserts interactions only, and the judge decides whether each mocked collaborator is an unmanaged process boundary. Value, error, property and snapshot matchers (`toBe`, `toEqual`, `toThrow`, `toMatchObject`, `toHaveProperty`, ...) count as outcomes.

The rule has three triggers, reported under distinct keys. `file-density` is the file-level trigger described above. `interaction-only` fires when two or more tests, or a share of at least `minInteractionShare` (default 0.5) of the tests in a file, assert interactions only; the finding lists the doubles per test, and the trigger is skipped when `file-density` already fires. `snapshot-only` fires on two or more tests whose only oracle is a whole-value snapshot, or on an inline snapshot longer than `maxInlineSnapshotLines` (default 12). The method for choosing the right double and the right oracle stays in the `test-strategy` and `testing` skills; the rule only asks the closed question per double.

### abstraction-earns-keep: implementers, not names

The rule counts implementers instead of reading names. It reports a behaviour-only interface or type alias whose members equal those of its only implementer in the file (class, `satisfies`, or annotated object); an `Impl`/`Default`/`Base`/`Concrete`/`Standard`/`Real` affix on an implementation of an interface imported from a relative module; a class whose members forward verbatim to one collaborator; and a module whose exports all forward, which replaces the per-export findings it covers. Options: `minForwardingMembers` (default 3), `forwardingRatio` (default 0.8). Name-based matching is opt-in through `interfacePattern` (recommended value `/^I[A-Z][a-z]|Interface$/`, which keeps `IPAddress` silent) and is suppressed when the file shows two or more implementers. The single-file view only sees a ports-and-adapters layout through the affix trigger, so the judge must search the repository for a second implementer or a test double before failing a finding. An abstraction that makes the code easier to modify today passes even with one implementer.

### fallback-masks-failure (opt-in)

Not part of `strictPreset`; measure its volume on your code before enforcing it. Triggers, one finding per function at most:

- `??` or `||` with an empty literal on the right (`""`, ` `` `, `0`, `[]`, `{}`, `"unknown"`, `"N/A"`) when the left side names required data. The name is the trailing property, string key (`form.get("email")`, `headers["x-api-token"]`) or callee, split into segments and compared with `sensitiveNames` (default: id, key, token, secret, price, amount, total, cost, fee, tax, balance, quantity, count, currency, url, email, sku, ...). `width` does not match `id`.
- Two or more such fallbacks on ordinary names in one function (`minFallbacksPerScope`).
- A parameter or destructuring default with an empty literal, for required-looking names only.
- A `catch` clause or `.catch(callback)` whose every return is an empty literal, `null` or `undefined` and that discards the error (same definition as boundary-resilience, including the `REASON:` escape).

Fallbacks inside JSX expressions and attributes are display defaults and stay silent. The default binding excludes test files. Fallbacks the type checker can prove useless belong to `typescript/no-unnecessary-condition`; this rule reviews the rest. When a network `try/catch` returns an empty literal, this rule and boundary-resilience both report it.

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { defineFallbackMasksFailure, strictPreset } from "@aurelienbbn/agentlint-plugin-core";

export default defineConfig({
  extends: [strictPreset],
  rules: [defineFallbackMasksFailure({ minFallbacksPerScope: 3 })],
});
```

### test-expectation-drift: change rule, human authority

The only change-lifecycle rule in this package. It reads diff hunks of test files (and `*.snap` files) and reports once per file, with the kinds it saw:

- `assertion-removed`: more assertion lines deleted than added. A line that reappears verbatim anywhere in the change is a move and leaves both sides first.
- `test-removed`: more `it(`/`test(` lines deleted than added, or a test file deleted while no source file with the same stem is deleted or renamed.
- `matcher-downgraded`: the same `expect(subject)` goes down `toStrictEqual` > `toEqual`/`toBe` > `toMatchObject` > `toHaveProperty`/`toContain`/`toBeDefined`/`toBeTruthy`, from `toBe` to `toBeCloseTo`, or gains `expect.any`/`expect.anything`/`expect.objectContaining`/`expect.arrayContaining`.
- `expectation-revalued`: same subject, same matcher, different argument, and a non-test source file was modified in the same change.
- `disabled`: a `.skip`, `.todo`, `.fails` or `xit`/`xtest`/`xdescribe` was added.
- `snapshot-rewritten`: lines deleted from a `.snap` file or from a multi-line `toMatchInlineSnapshot` body while source changed.

Added test files, additions-only hunks, strengthened matchers and a test deleted together with its source stay silent. The binding includes source files on purpose: the engine filters a change by the binding before detection, so narrowing `include` to test files would hide the source edits two of the kinds depend on.

**Authority defaults to `"human"`**, unlike every other rule here. The author of a change is the party tempted to accept a finding about that change. `defineTestExpectationDrift({ authority: "agent" })` restores the usual default. Other options: `testFilePattern`, `assertionPattern`, `maxEvidenceLines`.

### expected-value-recomputed

Test files only. Reports `expect(subject(...)).toBe|toEqual|toStrictEqual|toBeCloseTo|toContain|toMatchObject(expected)` when `expected` (or the local `const` it names, inside the same test callback) is computed: arithmetic with a non-literal operand, a `map`/`filter`/`reduce`/`join`/`replace`/`toLowerCase`/`toFixed`/`round`... call, or a template with two or more substitutions. It is reported only when the expected expression shares an identifier with the arguments of the subject call, or calls something imported from the subject's own module. `60 * 60 * 1000`, a URL built from an unrelated constant, `expect.*` asymmetric matchers and bodies of `fc.property`/`it.prop` stay silent. Three findings per file at most. Options: `matcherPattern`, `derivationCallees`, `maxFindingsPerFile`.

### integration-test-owns-its-boundary

Test files whose path has an `integration` or `e2e` segment or name part (`orders.integration.test.ts`, `tests/integration/...`, `e2e/...`), or whose first `describe` title contains "integration", and whose code constructs doubles: `vi.fn(`, `createMock(`, `mockX(`, `fakeX(`, or an `InMemoryX`/`FakeX`/`StubX` name. Strings and comments are ignored; the doubles are the evidence. `int` and `contract` are deliberately not integration markers: `print.test.ts` must stay silent, and a contract suite legitimately runs the fake next to the real thing. One finding per file. Options: `integrationPattern`, `doublePattern`.

### correlated-optional-state

Non-test files. An interface or object type alias with a required `status`/`state`/`kind`/`type`/`phase`/`step`/`mode`/`variant` field typed as a union of string literals, plus at least two fields that are optional or `| null`/`| undefined`. Types named `*Props`, `*Options`, `*Config`, `*Params`, `*Args`, `*Input`, `*Query`, `*Filter`, `*Patch`, `*Update` are skipped, as are object types that are already members of a union or intersection. Bags of lifecycle booleans belong to `no-impossible-state-bag` in the type-evidence oxlint plugin. Options: `discriminantNames`, `minOptionalSiblings`, `skipNamePattern`.

### temporal-coupling

Non-test files, one finding per class, with the signals as evidence:

- `guard-throw`: a `throw` in the class whose message says "not initialized/connected/started/configured/ready/loaded/opened", "call x() first/before" or "must call/be initialized".
- `definite-assignment`: an undecorated `name!: T` field assigned in a method and never in the constructor.
- `nullable-init`: a `| null`/`| undefined` field given a value by exactly one method named `init`, `initialize`, `setup`, `connect`, `open`, `start`, `load`, `configure` or `bootstrap`, and null-checked in at least two other methods.

Decorated framework fields (`@property() name!: string`), `!` fields the constructor assigns, and ordinary errors such as "User not found" stay silent. Factory closures are not inspected in this version. Options: `guardMessagePattern`, `initMethodPattern`.

### test-exercises-project-code

Test files with at least one `it`/`test` call and no module specifier that reaches the project: relative, `@/`, `~/`, `#...`, or a name listed in `workspacePackages`, through `import`, `export ... from`, `import()`, `require()` or `vi.importActual()`. Black-box drivers keep it silent: `node:child_process`, `execa`, `node:fs`, `node:fs/promises`, `@playwright/test`, `supertest`, `undici`, or a bare `fetch(` call. `*.test-d.ts` is excluded. A monorepo that imports itself by package name records those names in `workspacePackages`. Other options: `projectImportPattern`, `blackBoxModules`.

### Opt-in judgment rules (MAYBE)

Exported, not part of any preset. Each prescribes a fix that is expensive or whose volume is unknown; run `agentlint rules scan --review` on your code and promote a rule only when most of its findings lead to a change.

- `isomorphicMapping` (`core/isomorphic-mapping`): Flags functions that copy an object field by field into a same-shaped object, to check that a real boundary separates the two types.
- `flagForkedFunction` (`core/flag-forked-function`): Flags functions whose boolean or literal-union parameters are used only to choose between code paths, to check whether they are two functions sharing a name.
- `propertyTestOpportunity` (`core/property-test-opportunity`): Flags test files that cover an encode/decode-style inverse pair or an idempotent normaliser with examples only, where one property would cover the open input domain.
- `fakeParity` (`core/fake-parity`): Flags hand-written stateful fakes of a port so a shared behaviour suite or contract test proves they still behave like the real implementation.
- `validationDiscardsProof` (`core/validation-discards-proof`): Flags validate/check/ensure functions that return void or boolean without a type predicate, so what they proved is lost to the type system. Where `fallback-masks-failure` reports the default that papers over absence, this rule reports the place the proof should have been produced.
- `pinnedSuspectOutput` (`core/pinned-suspect-output`): Flags expected strings and inline snapshots that contain `undefined`, `NaN`, `[object Object]`, `Invalid Date` or an embedded `null`, which usually certify a bug the test recorded.

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { fakeParity, strictPreset } from "@aurelienbbn/agentlint-plugin-core";

export default defineConfig({ extends: [strictPreset], rules: [fakeParity] });
```

### Concept credits for the sections above

- fallback-masks-failure: "Parse, don't validate" by Alexis King — absence is rejected once, at the boundary. Concept only.
- test-behavior-coverage: "When to Mock" by Vladimir Khorikov — interaction assertions belong to unmanaged out-of-process dependencies. Concept only.
- test-expectation-drift: ImpossibleBench (arXiv 2510.20270) — passing by editing the oracle; "Characterization Testing" by Michael Feathers. Concepts only.
- expected-value-recomputed: "Don't Put Logic in Tests" (Google Testing Blog). Concept only.
- integration-test-owns-its-boundary: "IntegrationTest" by Martin Fowler — narrow integration tests double the remote, not the adapter. Concept only.
- correlated-optional-state: "Designing with types: Making illegal states unrepresentable" by Scott Wlaschin. Concept only.
- abstraction-earns-keep: "Interfaces are not abstractions" by Mark Seemann — header interfaces with one implementer. Concept only.
- temporal-coupling: "Design Smell: Temporal Coupling" by Mark Seemann. Concept only.
- flag-forked-function: "The Wrong Abstraction" by Sandi Metz; "FlagArgument" by Martin Fowler. Concepts only.
- property-test-opportunity: "Choosing properties for property-based testing" by Scott Wlaschin — inverse and idempotence families. Concept only.
- fake-parity: "ContractTest" by Martin Fowler; "Getting Started with Contract Tests" by J. B. Rainsberger. Concepts only.
- validation-discards-proof: "Parse, don't validate" by Alexis King. Concept only.

## Contract boundaries and migration

These rules produce contextual review prompts, not correctness proofs. Bounded-work analysis separates enclosing operations; a cursor alone is not a cardinality bound, and cancellation is not a deadline. The test-behavior detector measures mock/assertion density per file; it does not establish per-test coverage. Migration: boundary-resilience (standard revision 2, detector version 2) now reports discarding handlers around outbound calls and no longer accepts resilience words outside the argument list; test-behavior-coverage (revision 3, version 3) reports files whose only assertions are interaction matchers, interaction-only tests, and snapshot-only tests; abstraction-earns-keep (revision 2, version 2) counts implementers and forwarding members, and no longer reports `IName`/`...Interface` names unless `interfacePattern` is set. Existing acceptances for all three rules need a fresh review. `flag-forked-function` skips JSX files unless `includeJsx` is set. Units, invariants, and useful public-interface documentation are valid comments even when short.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                           | Trigger or review scope                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `abstraction-earns-keep`             | Flags interfaces that mirror their only implementer, classes and modules that forward verbatim to one collaborator, and exports that only delegate to a single call.                 |
| `boundary-resilience`                | Flags outbound network calls that show no timeout or AbortSignal, and handlers around them that discard the failure.                                                                 |
| `bounded-data-access`                | Flags repository-like list/search/query calls without obvious boundedness markers.                                                                                                   |
| `bounded-work`                       | Flags execution paths with unbounded I/O, fan-out, or runtime budgets.                                                                                                               |
| `comment-signal`                     | Flags comments that narrate the next line or docblocks that restate the signature.                                                                                                   |
| `correlated-optional-state`          | Flags object types that pair a literal-union status field with two or more optional fields, where a discriminated union would make illegal combinations unrepresentable.             |
| `expected-value-recomputed`          | Flags assertions whose expected value is computed from the same inputs as the call under test instead of being stated.                                                               |
| `fake-parity`                        | Flags hand-written stateful fakes of a port so a shared behaviour suite or contract test proves they still behave like the real implementation.                                      |
| `fallback-masks-failure`             | Flags empty-literal fallbacks on required-looking values, fallback-dense functions, and error handlers that return an empty literal.                                                 |
| `flag-forked-function`               | Flags functions whose boolean or literal-union parameters are used only to choose between code paths, to check whether they are two functions sharing a name.                        |
| `integration-test-owns-its-boundary` | Flags test files named or titled as integration tests that also construct test doubles, so the claimed boundary is checked to be real.                                               |
| `isomorphic-mapping`                 | Flags functions that copy an object field by field into a same-shaped object, to check that a real boundary separates the two types.                                                 |
| `pinned-suspect-output`              | Flags expected strings and inline snapshots that contain `undefined`, `NaN`, `[object Object]`, `Invalid Date` or an embedded `null`, which usually certify a bug the test recorded. |
| `property-test-opportunity`          | Flags test files that cover an encode/decode-style inverse pair or an idempotent normaliser with examples only, where one property would cover the open input domain.                |
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

<!-- harness-catalog:end -->

## Current rule contract

Rules expose `lifecycle`, `standard` (revision), `detector` (version), and `binding` (id, authority, scope, material options). Presets use arrays of bindings: `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`. Configure repeated uses with distinct binding ids. Repository owners choose scope and can raise authority to `human`; defaults permit agent acceptance. Acceptance requires matching current evidence and authority. `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser.

## Start with a focused review

The opt-in `starterPreset` includes `boundaryResilience`, `boundedWork`. Install a compatible local draft of this package and agentlint, then run:

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-core#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` preserves an existing config and prints the package installation command. It never installs packages itself. Inspect and calibrate the bindings before making `agentlint check --all` required. This gradual onboarding takes conceptual inspiration from desloppify by Peter O'Malley; no code or guidance was copied.
