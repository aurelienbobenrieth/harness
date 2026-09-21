# Repository review — 2026-09-05

The repository has a useful purpose and a sensible package taxonomy, but its current green gate overstates the reliability of the rules. The first investment should be making existing rules trustworthy, not adding more rules. Several rules are unreachable through their real runner, some accept the exact violation they promise to prevent, and some reject legitimate code or recommend behavior that can reduce quality.

This review covers the current working tree, including pre-existing uncommitted work: **21 packages, 104 rules, and 38 conformance checks**, plus the CLI, presets, build, test helpers, release configuration, and documentation. Implementation and registration were inspected throughout; test contracts and relevant assertions were examined, supplemented by actual-runner probes. This is not a claim of exhaustive execution of every possible syntax or framework version. No package implementation was changed during the review.

## Product assessment

The goal in AGENTS.md is reusable steering that compounds code quality across projects, with stack-agnostic core packages and domain-specific rules in their narrowest reusable package. You confirmed that defaults should be **opinionated for your projects**, and that this pass should produce **review and recommendations first**. OSS-grade engineering here means dependable implementation, packaging, and public contracts; it does not require neutral defaults for every developer.

The current portfolio mixes three different products:

| Contract                                       | Appropriate behavior                                                                  | Examples                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Demonstrable correctness or platform invariant | Deterministic diagnostic with a precise trigger and low false-positive rate           | Invalid schema, floating Effect, inaccessible attribute, malformed registry              |
| Architectural or stylistic policy              | Explicitly named configurable preset, with documented tradeoffs                       | Root imports, named contracts, no native switch, service ownership, Theme OS conventions |
| Contextual review prompt                       | Agent review anchored to the relevant code, with room to retain valid implementations | Abstraction value, mutation feedback, retry/idempotency design, UI failure states        |

These can coexist. Problems arise when a policy is described as a type-safety fact, a text match is described as proof of platform compliance, or an agent heuristic is treated as a comprehensive quality gate.

Recommended product changes:

1. Keep dependable opinionated defaults, with named architecture presets where different projects need different policies. Personal preferences need not be opt-in merely because they are opinions. `no-let` is already opt-in: preserve that distinction unless deliberately changing the product contract. Do not equate greater restriction with better software.
2. Separate generic Shopify requirements from Theme OS registry, documentation, namespace, route, and token conventions. Likewise, remove the default `oio` naming contract from generic XState and the theme-specific rationale from generic Lit.
3. Give every rule a mechanically checked contract: owner, enforcement layer, supported syntax/API versions, default severity, known limitations, valid exceptions, and regression fixtures. Generate the public inventory from registration.
4. Resolve conflicting incentives: banning useful boundary narrowing encourages casts; banning test fakes encourages difficult integration tests; requiring high priority for every eager image competes with the actual LCP image; banning loops can encourage repeated copying with worse complexity.
5. Resolve duplicate ownership. SEO/meta checks, surface/preset/docs checks, shadow-DOM checks, and test-quality checks currently overlap. Complementary static and contextual checks are useful only when they answer distinct questions and avoid duplicate findings.

## Prioritized findings

“Reproduced” means an isolated probe ran against the current built package or actual tool. “Inspection” means the implementation or test contract establishes the concern, but its full impact was not separately reproduced. P1 means fix before relying on the affected feature; P2 means a significant reliability or product issue; P3 means maintenance improvement. There is no verified emergency production incident here.

### P1 — Invalid registry input can be silently overwritten

**Reproduced.** `oio registry sync` received a registry containing `not json`, exited successfully, and replaced it with reconstructed entries. Existing metadata is therefore at risk exactly when input is damaged. Registry parsing falls back to an empty collection. Scaffold has the same permissive approach and writes generated files before validating all registry state.

Reject malformed or structurally invalid input before any mutation. Decode entries rather than casting parsed arrays. Prepare and validate the entire result, then replace the registry atomically; avoid check-then-write races when creating files. Preserve metadata deliberately and fail visibly on malformed Markdown rows. Add a test asserting byte-for-byte preservation on invalid input, not merely a failing exit code.

Source: [oio source](../../packages/oio/src). Evidence: `oio-invalid-registry` in [probe results](../../.tmp/repo-review-probes.json).

### P1 — Three agent rules are unreachable for normal inputs

**Reproduced through the actual agentlint CLI with other rules as positive controls.** `prefer-schema-contracts` looks for `export` inside interface/type declaration text, but the parser places it on the enclosing export statement. The unit fixtures manufacture a declaration shape the real parser does not produce. Theme `no-js-fallback` and `primitive-doc` match relative-path anchors against the absolute paths supplied to `before` by the runner.

Use the real parser's export structure and normalize paths against the configured project root. Add at least one actual-runner positive and negative case for every plugin; include Windows paths and nested workspaces. Mock visitor tests alone cannot establish that a rule is reachable.

Sources: [Effect rule](../../packages/agentlint-plugin-effect/src/rules/prefer-schema-contracts/rule.ts), [fallback rule](../../packages/agentlint-plugin-shopify-theme/src/rules/no-js-fallback/rule.ts), [documentation rule](../../packages/agentlint-plugin-shopify-theme/src/rules/primitive-doc/rule.ts). Evidence: [actual-runner output](../../.tmp/repo-review-agent-output.json).

### P1 — Valid recursive types crash type-evidence linting

**Reproduced.** `type Recursive = Promise<Recursive>; function load(): Recursive { return load(); }` triggers `RangeError: Maximum call stack size exceeded`. Recursive alias resolution loses its visited state across recursive `returnsUnknown` calls.

Carry a single cycle guard through the traversal, memoize completed queries per file, and make cycles a normal analysis outcome. Test direct, mutual, and container-mediated recursion. This is a linter termination defect independent of whether that particular function is useful application code.

Source: [no-unknown-returns](../../packages/oxlint-plugin-type-evidence/src/rules/no-unknown-returns/rule.ts). Evidence: `recursive-type` in [probe results](../../.tmp/repo-review-probes.json).

### P1 — Invalid conformance inputs throw instead of producing findings

**Reproduced.** A Liquid schema containing JSON `null`, a template with a null section, and a null registry each throw. Conversely, `{"sections":[]}` passes the template check. `section-schema-valid` rejects a header-only settings list, yet accepts a list containing one valid input and another input missing its required ID.

Validate parsed shapes once before semantic checks. Keep parse/shape findings distinct from reference and policy findings. One damaged file should produce an actionable path-specific diagnostic without preventing independent checks from running. Test nulls, arrays where objects are expected, mixed valid/invalid entries, nested blocks, and duplicate identifiers.

Sources: [theme checks](../../packages/conformance-shopify-theme/src/checks), [Liquid support](../../packages/conformance-shopify-theme/src/liquid-support.ts). Evidence: `schema-*`, `template-*`, and `registry-null` in [probe results](../../.tmp/repo-review-probes.json).

### P1 — Effect safety rules miss code encouraged by the preset

**Reproduced.** Standalone `Effect.log("lost")` passes `no-floating-effect` because log calls are explicitly exempted, although they return lazy Effects. The named curried form `Effect.fn("work")(function* () { throw new Error("oops"); })` passes `no-unsafe-effect-body`. Conversely, a data-last `Effect.forEach` with an explicit concurrency option is rejected.

Create a shared, small recognizer for supported Effect calls, imports, currying, and body ownership. Test the public API shapes together as consumer programs. Explicitly declare supported Effect majors: the installed Effect 4 source uses `catchCause` and `Cause.UnknownError`, while some rule names/recognizers assume older API forms. A required catch mapper may be a good domain-error policy, but “otherwise leaks unknown” is not an accurate description of this installed `tryPromise` overload.

Sources: [floating rule](../../packages/oxlint-plugin-effect/src/rules/no-floating-effect/rule.ts), [body rule](../../packages/oxlint-plugin-effect/src/rules/no-unsafe-effect-body/rule.ts), [concurrency rule](../../packages/oxlint-plugin-effect/src/rules/require-for-each-concurrency/rule.ts). Evidence: `floating-log`, `named-effect-body`, and `curried-concurrency` in [probe results](../../.tmp/repo-review-probes.json). Lazy logging is also described in [Effect logging documentation](https://effect.website/docs/v3/observability/logging/); version-specific conclusions above were checked against the installed Effect source.

### P1 — The validation gate does not establish source type correctness

**Reproduced.** `pnpm check` passes, but `pnpm exec tsc -p packages/oxlint-plugin-core/tsconfig.json --noEmit` fails, including TS2345 errors in `no-multi-positional-parameters` involving its custom `ParentNode` type. The same invocation also exposes test configuration problems: unresolved `vitest` and TS5097 for `.ts` imports. Only this package received a supplemental `tsc` invocation; this is not a claim that all packages fail.

Add an intentional workspace typecheck, with separate source/test configurations if needed, and include it in `check`. Declaration generation is not a substitute for checking every implementation and test source. Fix the test helper contract and AST types rather than casting away these errors.

Sources: [root scripts](../../package.json), [affected rule](../../packages/oxlint-plugin-core/src/rules/no-multi-positional-parameters/rule.ts). Evidence: [.tmp/repo-review-typecheck-core.log](../../.tmp/repo-review-typecheck-core.log).

### P2 — Test helpers can certify a rule that never ran

**Inspection, reinforced by the unreachable-rule probes.** Oxlint tests execute built `dist`, so direct test/watch runs can use stale implementation. Negative cases commonly assert only the absence of the expected diagnostic code; a parser/plugin failure can satisfy that assertion. Agent tests use fabricated syntax nodes. Stylelint helpers filter findings in ways that can hide parser failures. Temporary fixtures are not consistently removed.

Require successful parsing/plugin execution, exact rule identity, and useful location/message assertions before checking expected diagnostics. Add actual-runner smoke tests and a consumer fixture that enables each package's published preset. Make the build dependency of tests explicit. Test malformed inputs and aliases as first-class contracts. Retain focused unit tests; do not replace everything with expensive subprocess tests.

Sources: package `src/rules/test-support.ts` helpers and [test inventory](../../.tmp/repo-review-test-inventory.txt).

### P2 — Some rules mistake spelling for semantic ownership

**Reproduced.** `"hello".includes("h")` is reported as a native array helper; an ordinary `makeUrl` import is reported as an Effect service constructor; `response.send({type:"json"})` is reported as an XState event; a local mutable `state` causes an exported primitive of the same name to be reported. An export placed before the mutable declaration is missed.

Use AST scope/import provenance and declaration identity. When the available analysis cannot prove ownership, narrow the contract instead of using broad method/name matches. Oxlint exposes [scope analysis and AST facilities](https://oxc.rs/docs/guide/usage/linter/js-plugins.html), although custom JS plugins do not thereby gain arbitrary TypeScript type-checker access.

Sources: [array helper](../../packages/oxlint-plugin-effect/src/rules/prefer-effect-array-helpers/rule.ts), [service import](../../packages/oxlint-plugin-effect/src/rules/no-service-constructor-imports/rule.ts), [event rule](../../packages/oxlint-plugin-xstate/src/rules/require-event-satisfies/rule.ts), [mutable exports](../../packages/oxlint-plugin-core/src/rules/no-mutable-exported-state/rule.ts). A separate cross-file probe did **not** reproduce state leakage; scope and declaration-order defects above are confirmed.

### P2 — Type-evidence sometimes enforces naming, not evidence

**Reproduced and encoded in existing expectations.** A precise annotation such as `const point: { x: number; y: number } = { x: 1, y: 2 }` is described as a broad type discarding evidence. Naming the same structural contract is not inherently safer. Blanket restrictions on `unknown` parameters and `typeof` also reject legitimate decoding boundaries and narrowing.

Keep guards against double assertions and demonstrable widen-then-assert patterns. Separate named-public-contract policy from evidence preservation. Permit explicit decoding boundaries and useful generic constraints. Do not require meaningless safety comments or names to evade diagnostics. [TypeScript's narrowing documentation](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) treats `typeof` refinement as an ordinary type-safe operation.

Source: [type-evidence rules](../../packages/oxlint-plugin-type-evidence/src/rules). Evidence: `precise-type` in [probe results](../../.tmp/repo-review-probes.json).

### P2 — Performance and accessibility policies conflict with their goals

**Inspection plus reproduced CSS cases.** `lcp-priority` treats eager images as requiring high fetch priority. Shopify recommends high priority for the actual LCP image, typically one per page, not every eager image. With a configured breakpoint list, `breakpoint-tokens` rejects `prefers-reduced-motion`, directly conflicting with the reduced-motion policy. The advertised JS budget also differs between a total-dependency rationale and per-asset limits; many individually small chunks can evade the intended total.

Model the LCP candidate explicitly, restrict breakpoint enforcement to dimensional features, and define one budget contract distinguishing entry graph, individual asset, raw bytes, and compressed bytes. These are different measurements and must not share an ambiguous “bundle size” claim.

Sources: [LCP check](../../packages/conformance-shopify-theme/src/checks/lcp-priority.ts), [breakpoint rule](../../packages/stylelint-plugin-shopify-theme/src/rules/breakpoint-tokens/rule.ts), [Shopify guidance](https://shopify.dev/docs/storefronts/themes/best-practices/performance/set-fetchpriority-high-on-lcp-image). Evidence: [extra probes](../../.tmp/repo-review-extra-output.json).

### P2 — Text presence is being sold as stronger conformance

**Reproduced.** Commented webhook configuration and an HTML comment mentioning App Bridge pass their checks. A script URL containing `async` passes the blocking-script check without an async attribute. `<main role="main">` is counted twice. Raw Liquid image URLs bypass required dimensions; nested CSS escapes selector checks; an assets-only stylesheet is excluded from token validation. An Asset API GET is reported as a write, and `fetch(url, undefined)` is accepted as having cancellation.

Use the existing domain parser where available; add a narrowly scoped parser where necessary. Evaluate attributes, TOML values, HTTP methods, and executable nodes rather than substrings. Document static-analysis limits rather than promising complete platform compliance. Integrate official validators for platform contracts already maintained upstream.

Sources: [app checks](../../packages/conformance-shopify-app/src/checks), [theme checks](../../packages/conformance-shopify-theme/src/checks), [app lint rules](../../packages/oxlint-plugin-shopify-app/src/rules). Evidence: [probe results](../../.tmp/repo-review-probes.json).

### P2 — Required gates can silently skip; dependency overlap rejects complementary tools

**Reproduced.** Missing Knip/configuration yields a warning even with `requireKnipConfig: true`; the Vitest adapter passes warnings without displaying them. Separately, `dotenv` plus `dotenv-expand` fails dependency overlap, although upstream documents their use together.

Give checks explicit pass/fail/skip outcomes and make required prerequisites fail. Surface optional skips in every adapter. Restrict dependency overlap to configured, genuinely substitutable families within the same deployment boundary; otherwise make it advisory. A monorepo can legitimately use different libraries in browser and server applications. Also inspect Windows command quoting: the shell helper handles whitespace/quotes but not all shell metacharacters; this is a code-inspection concern, not a demonstrated exploit.

Sources: [core conformance](../../packages/conformance-core/src), [dotenv-expand usage](https://github.com/dotenvx/dotenv-expand). Evidence: `overlap-complementary` and `core-tool-missing` in [probe results](../../.tmp/repo-review-probes.json).

## Complete package and rule disposition

“Keep” endorses the objective, not a claim that the implementation has no remaining defects. “Tighten” means retain after narrowing or correcting detection. “Policy” means an explicit architectural contract rather than an unconditional quality claim; it can remain enabled by default for your projects. Rows group rules only when their disposition is related; every registered rule/check is named.

### 1. agentlint-plugin-core — 6 rules

| Rules                    | Disposition                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `abstraction-earns-keep` | Keep as judgment. A single implementation can still justify a stable public boundary or integration seam; naming and one-call wrappers are prompts, not proof of waste.                   |
| `boundary-resilience`    | Keep; distinguish cancellation from a deadline, and inspect retry/idempotency/error handling at the actual boundary. A signal alone does not establish bounded duration.                  |
| `bounded-data-access`    | Tighten. `cursor`, `after`, `before`, or `id` somewhere in arguments does not bound cardinality; slicing after retrieval does not bound the query.                                        |
| `bounded-work`           | Tighten to the enclosing operation. A loop and unrelated await anywhere in the program should not combine into evidence. Preserve sequential work when ordering/backpressure requires it. |
| `comment-signal`         | Tighten. A shared four-character word is weak evidence of narration; concise parameter-unit documentation is useful. Correct the line-coordinate handling around comments.                |
| `test-behavior-coverage` | Keep as per-test judgment. Avoid file-wide suppression and repeated full-source scans per call. Align interaction-assertion guidance with core lint.                                      |

### 2. agentlint-plugin-effect — 1 rule

| Rule                      | Disposition                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prefer-schema-contracts` | Fix unreachable visitor first. Scope runtime schemas to real runtime boundaries; an internal compile-time interface does not automatically need a runtime decoder. |

### 3. agentlint-plugin-lit — 2 rules

| Rules                 | Disposition                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `light-dom-boundary`  | Policy. Separate Theme OS's light-DOM preference from general Lit quality; resolve overlap with the deterministic rule. Light DOM alone is not proof that progressive enhancement preserves server-rendered content. |
| `task-state-coverage` | Keep. Bind the review to the task's consuming UI and handle aliases; one marker elsewhere is not proof of pending/error/empty coverage.                                                                              |

### 4. agentlint-plugin-shopify-app — 4 rules

| Rules                         | Disposition                                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout-network-discipline` | Keep with explicit scope and overlap ownership with boundary-resilience. Review deadlines, retries, and mutation idempotency rather than generic token presence.                                           |
| `no-pressure-copy`            | Keep as judgment; examine rendered strings/locales. Preset scope currently misses locale JSON despite the stated copy objective; all string literals are too broad. Reset configurable global regex state. |
| `session-token-auth`          | Keep as review prompt, not authentication proof. Resolve actual API/auth boundary and recognize approved server/client mechanisms.                                                                         |
| `settings-save-bar`           | Tighten form ownership. A marker or one compliant form should not suppress unrelated forms; cover self-closing form syntax where applicable.                                                               |

### 5. agentlint-plugin-shopify-theme — 10 rules

| Rules                     | Disposition                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `apg-pattern`             | Keep contextual. Parse roles and distinguish modal from nonmodal dialogs; not every dialog requires a focus trap.                             |
| `cart-mutation-feedback`  | Keep. Align suggested event names with the enforced vocabulary; `cart:updated` conflicts with the current allowed prefixes.                   |
| `copy-quality`            | Keep; cover locale-owned text and define whether custom weak phrases extend or replace defaults.                                              |
| `no-js-fallback`          | Fix absolute-path mismatch; then retain review of real no-JS usefulness, not fallback keyword presence.                                       |
| `primitive-doc`           | Fix absolute-path mismatch. Move deterministic required-doc presence to conformance; `@example` alone does not prove an example is useful.    |
| `registry-drift`          | Move deterministic drift ownership to conformance; share accepted registry shapes with oio. Avoid stale cache state across runs.              |
| `respect-reduced-motion`  | Keep. Verify that the actual motion is guarded; a matching helper name elsewhere is not proof.                                                |
| `schema-ux`               | Keep UX judgment; move deterministic missing translation/group-shape checks to conformance. Validate JSON shape before traversal.             |
| `translated-ui-strings`   | Keep with honest coverage of text/attributes/bindings and properly escaped configured patterns.                                               |
| `web-component-lifecycle` | Keep. Anchor cleanup to each allocated listener, observer, subscription, or actor; a disconnectedCallback somewhere is insufficient evidence. |

### 6. agentlint-plugin-tanstack-query — 1 rule

| Rule                   | Disposition                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `query-state-coverage` | Keep. Review the UI consumer, account for aliases and suspense APIs, and avoid demanding the same states at both query definition and consumer. |

### 7. agentlint-plugin-xstate — 3 rules

| Rules                      | Disposition                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actor-cleanup`            | Keep; establish actor ownership and lifetime rather than requiring every local actor reference to stop itself.                                                                                                    |
| `derived-boolean-context`  | Keep as judgment. Boolean naming alone cannot distinguish stored domain facts from redundant derived state.                                                                                                       |
| `machine-failure-coverage` | Tighten per invocation. One onError/onSnapshot anywhere does not cover every actor; onSnapshot is not an error handler. Pure machines without an invocation should not receive a generic missing-failure warning. |

### 8. conformance-core — 4 checks

| Checks                       | Disposition                                                                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dead-exports`               | Keep as adapter to Knip. Required missing tooling/configuration must fail; optional skips must be visible. Support tool timeout in the Vitest adapter.                                                                            |
| `duplication-budget`         | Keep, but measure/document scope and generated exclusions. Avoid forcing abstractions solely to meet a token budget; report useful locations.                                                                                     |
| `dependency-overlap`         | Redesign as configured equivalence within a deployment unit; remove complementary-library pairs.                                                                                                                                  |
| `closed-design-system-probe` | Move Tailwind defaults out of core. Generic command/probe execution can stay. Parse exact selectors rather than `.includes`, ensure probe classes actually enter the build, and do not call a finite blacklist “closed” coverage. |

This package deserves a robust process runner and common result adapter, not a general plugin framework. Shell invocation, timeout behavior, missing tools, and skips are its public contract.

### 9. conformance-shopify-app — 4 checks

| Checks                   | Disposition                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app-bridge-script`      | Parse executable markup and selected embedded-app configuration. A comment is not a loaded script; one unrelated `embedded=false` must not disable checks for every app. |
| `checkout-bundle-size`   | Identify actual checkout extensions and built entry graphs. Missing build output must not silently prove a budget; define recursive/chunk accounting.                    |
| `compliance-webhooks`    | Parse TOML; check the selected deployment manifest. Do not combine required topics from unrelated environment manifests or comments.                                     |
| `functions-localization` | Parse configuration and validate that resolved locale values are strings on owned properties; distinguish missing resources from irrelevant extensions.                  |

### 10. conformance-shopify-theme — 30 checks

| Checks                       | Disposition                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `asset-budget`               | Keep; centralize units/limits with oio and distinguish per-file from aggregate entry cost.                                                                                                 |
| `contrast-guard`             | Configure actual foreground/background pairs. Cartesian comparison of every token combination rejects combinations that are never used; handle alpha/compositing or declare limits.        |
| `event-contract`             | Keep; share vocabulary and constant resolution with lint. Literal-only discovery cannot correctly judge projects encouraged to use constants.                                              |
| `heading-order`              | Rename or implement the promised order check. Filename-based h1 policy is not heading-order validation; exclude comments.                                                                  |
| `image-dimensions`           | Fix broad Liquid interpolation bypass; validate actual width/height attributes or recognized dimension-producing filters.                                                                  |
| `image-policy`               | Keep after attribute/filter parsing. State supported dynamic cases and avoid treating text matches as rendered image proof.                                                                |
| `landmarks`                  | Count semantic elements once; `<main role="main">` is one landmark. Parse comments and attributes.                                                                                         |
| `lcp-priority`               | Redesign around the LCP candidate rather than every eager image.                                                                                                                           |
| `liquiddoc-params`           | Tighten to actual parameter references; a mention in arbitrary text is not usage. Check both stale docs and undocumented parameters where statically knowable.                             |
| `liquiddoc-required`         | Theme OS policy. Consolidate doc ownership; replace magic generated-comment bypass with explicit generated-path configuration.                                                             |
| `locales-default`            | Require a storefront default, not merely a schema locale. Validate object shapes and distinguish storefront/schema locale families.                                                        |
| `meta-completeness`          | Consolidate with seo-contract, preserving separately useful requirements and one owner per diagnostic.                                                                                     |
| `no-parser-blocking-scripts` | Parse actual async/defer/type attributes; filenames containing `async` are not sufficient.                                                                                                 |
| `orphan-locale-keys`         | Handle parent-key pluralization and dynamic key families. Do not report valid plural leaves as unused or exempt all general keys without an explicit reason.                               |
| `preset-completeness`        | Policy scoped to merchant-addable surfaces. Do not force every static/internal component into a picker.                                                                                    |
| `preset-validity`            | Keep; validate nested blocks and value domains, not only top-level setting names.                                                                                                          |
| `registry-sync`              | Decode shape; check duplicate IDs, references, and cycles where disallowed. Define one format accepted by CLI and checks.                                                                  |
| `required-structure`         | Keep; ensure required entries are the correct file/directory kind and platform-valid layout.                                                                                               |
| `route-coverage`             | Theme OS policy with configurable account/route modes. Require actual valid template files rather than path presence.                                                                      |
| `schema-locale-keys`         | Keep; validate translation-bearing fields and resolved value types, with clear locale fallback semantics.                                                                                  |
| `section-schema-valid`       | Fix null handling and per-input IDs. Cover nested block IDs. The link_list-count restriction needs a versioned platform acceptance test before being presented as a universal requirement. |
| `seo-contract`               | Keep core SEO objective; consolidate duplicate meta checks and exclude comments.                                                                                                           |
| `settings-schema`            | Keep; decide missing-file requiredness, validate theme_info fields and input shapes rather than name presence alone.                                                                       |
| `stylesheet-scope`           | Parse nested rules/selectors; @media currently hides global selectors. Keep component scoping as explicit architecture policy.                                                             |
| `surface-classes`            | Theme OS policy. Align emitted check IDs with skip configuration and published budget semantics; remove duplicated preset/doc findings.                                                    |
| `templates-valid`            | Validate object/section/order structure and section references before traversal. Null sections must be findings, arrays must not pass.                                                     |
| `theme-liquid-contract`      | Parse required output placement, not mentions in comments. Correct zoom policy for numeric user-scalable values and legitimate maximum-scale values.                                       |
| `token-contract`             | Do not blanket-exclude all assets CSS. Make source/build scope explicit and inspect the stylesheet consumers actually ship.                                                                |
| `utility-grammar`            | Align documented patterns with matching behavior; currently exact membership is used. An explicitly empty safelist must have deliberate semantics.                                         |
| `visible-if-references`      | Validate nested block settings, correct section/block namespaces, and supported reference syntax.                                                                                          |

The [Shopify input-setting reference](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings) and [theme-block schema reference](https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/schema) should inform versioned fixtures. This review does not claim that the absence of a restriction from a documentation page proves the platform accepts every alternative.

### 11. oio — CLI

Keep the integrated scaffold/registry/catalog workflow: it is a useful product that can prevent convention drift. Its write safety and generated-output validity need stronger guarantees before expanding commands.

Beyond the registry defect: schema classes exist without consistently decoding configuration/registry inputs; raw filesystem promises can surface as defects instead of actionable typed failures; docs generation can fail after writing earlier outputs; a missing explicitly configured event file can silently become an empty event catalog. Generated namespace text is not consistently configuration-driven. Scaffolding creates translation references without fully establishing corresponding default locale content.

Introduce a small validated project model shared by scaffold, sync, docs, and conformance. Validate all inputs before writes; use atomic output replacement and explicit overwrite rules. Test generated projects through the actual lint/conformance/build tools rather than marker substring assertions. Keep service abstractions only where they own configuration, IO, or test seams; adding more request/result wrappers is lower value than using the existing schemas at the real boundaries.

### 12. oxfmt-config — formatter preset

Keep the small preset factory. Document whether list merging is append-only and how consumers remove defaults. Ensure returned nested arrays/objects do not accidentally share mutable state with later calls. Test consumer overrides and independence rather than only shallow equality. No larger abstraction is warranted.

### 13. oxlint-config — linter preset

Keep an opinionated strict preset, but distinguish it from stable recommended defaults. Enabling entire categories including nursery means upstream changes can materially change the contract. Broad test-rule disabling and Node defaults need scoped overrides for browser and test consumers. Define removal semantics for merged plugins/lists, and test a real consumer configuration. A passing root lint does not show every exported preset is usable or that this repository satisfies its own custom rules.

### 14. oxlint-plugin-core — 9 rules

| Rules                                 | Disposition                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-dead-comments`                    | Keep narrowly recognized dead code; do not confuse examples/documentation with commented-out implementation.                                                                      |
| `no-exported-anonymous-object-return` | Named public contracts are policy. Replace source-text parsing with AST and define public boundary scope; cover async/default/generic exports without mistaking nested returns.   |
| `no-let`                              | Preserve opt-in status. Local mutation can be clearest and avoid repeated-copy complexity; do not promote to a universal quality invariant.                                       |
| `no-multi-positional-parameters`      | Policy for APIs the project owns. Exempt externally imposed callback contracts such as comparators; fix source type errors.                                                       |
| `no-mutable-exported-state`           | Keep objective; fix lexical scope and forward exports. Use declaration identity, not a set of names.                                                                              |
| `no-reexport-only-modules`            | Policy. Deliberate package façades can stabilize public APIs; require explicit boundary exceptions.                                                                               |
| `no-vitest-in-source`                 | Keep import-boundary objective with documented test paths and type-only/import-form handling.                                                                                     |
| `no-vitest-mocking`                   | Split module replacement from deterministic fakes/spies. Banning vi.fn is not equivalent to ensuring behavior tests; keep blanket ban optional.                                   |
| `no-weak-test-assertions`             | Tighten per test and actual expect ownership. One `.toBe` anywhere should not certify a file; snapshots/interaction assertions can be meaningful contracts. Align agent guidance. |

### 15. oxlint-plugin-effect — 30 rules

| Rules                              | Disposition                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dependencies-first`               | Policy; syntax/spacing parsing is fragile, including named curried bodies. Formatting concerns belong in formatting when possible.                                                   |
| `no-ambient-nondeterminism`        | Keep testability goal; resolve imports/shadowing. Inject a cryptographically appropriate source where security requires it rather than directing every random call to a generic RNG. |
| `no-cascading-layer-provide`       | Architecture policy; independence is contextual. Consolidate recognizers with nested-layer rule.                                                                                     |
| `no-catch-all-cause`               | Keep intentional error handling; declare framework versions and recognize relevant current API names.                                                                                |
| `no-effect-ordie`                  | Keep in application/domain code with explicit boundary escape conventions. Converting expected failures to defects deserves review.                                                  |
| `no-floating-effect`               | Fix log exemptions and clarify direct-call versus composed/piped coverage.                                                                                                           |
| `no-nested-layer-provide`          | Policy; avoid repeated subtree walks and duplicated diagnostics with cascading-layer enforcement.                                                                                    |
| `no-raw-json-parse`                | Boundary policy; bind recognized schema APIs instead of allowing arbitrary Decoder-named wrappers. Coordinate with decode-unknown enforcement.                                       |
| `no-raw-json-stringify`            | Scope to owned serialization boundaries; debug output/fingerprints are not automatically missing domain encoders.                                                                    |
| `no-run-promise-in-runtime`        | Keep runtime ownership goal; consolidate with no-unscoped-runtime-launch and cover supported runner variants consistently.                                                           |
| `no-schema-any`                    | Keep; Schema.Unknown is a legitimate validation boundary, which must remain compatible with type-evidence policy.                                                                    |
| `no-service-constructor-imports`   | Fix provenance; a make-prefixed function is not evidence of an Effect service.                                                                                                       |
| `no-service-dependency-parameters` | Policy; use actual parameters/owned service types, not whole-source regexes and Config/Client names.                                                                                 |
| `no-service-option`                | Policy. Optional capabilities can be intentional; blanket rejection needs explicit architecture ownership.                                                                           |
| `no-static-service-forwarders`     | Policy; narrow to verified service forwarders. A named static operation may add a meaningful public boundary even when its implementation is one call.                               |
| `no-switch`                        | Policy. Exhaustive native switch can be correct, clear, and efficient.                                                                                                               |
| `no-unscoped-runtime-launch`       | Keep lifecycle goal; share runner identification and entrypoint configuration with no-run-promise-in-runtime.                                                                        |
| `no-unsafe-effect-body`            | Fix named curried bodies and aliases; test bodies encouraged by the naming rule itself.                                                                                              |
| `no-unsafe-error-channel`          | Keep typed domain errors; replace the mini source parser with TypeScript AST nodes. Arrow `>` tokens and aliases defeat ad hoc angle-bracket tracking.                               |
| `no-unsafe-error-mapper`           | Same AST/provenance correction; share only the truly common type/error recognition helpers.                                                                                          |
| `no-untyped-try-promise-catch`     | Rename/document as explicit domain-error mapping where appropriate; installed Effect 4 defaults to Cause.UnknownError, not an untyped unknown channel.                               |
| `prefer-effect-array-helpers`      | Policy; do not report strings and arbitrary same-named methods as arrays.                                                                                                            |
| `prefer-match`                     | Policy; retain report-only behavior because evaluation semantics can make rewrites unsafe.                                                                                           |
| `prefer-schema-decode-unknown`     | Keep boundary validation objective; align scope with no-raw-json-parse and use actual API identity.                                                                                  |
| `require-all-concurrency`          | Policy making defaults explicit. Support all documented forms and explain that omitted concurrency can already be sequential.                                                        |
| `require-for-each-concurrency`     | Fix data-last options; same explicit-default policy.                                                                                                                                 |
| `require-named-effect-fn`          | Keep traceability goal; validate nonblank names and decide how static constants are supported.                                                                                       |
| `require-tagged-effect-fail`       | Tighten name/contract. Rejecting literal forms does not prove tagged errors: identifiers/new Error can pass and valid tagged object values can fail.                                 |
| `schema-type-adjacent`             | Policy; support the chosen Effect version's type syntax and ignore intervening documentation comments. Public JSDoc should not become a violation.                                   |
| `use-root-imports`                 | Policy, not established performance improvement. Document supported import paths and framework versions.                                                                             |

This package is the largest concentration of bespoke lexical parsing and architectural policy. A small import/call/type-node support layer is justified; a new general analysis framework is not.

### 16. oxlint-plugin-lit — 4 rules

| Rules                           | Disposition                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `no-shadow-dom`                 | Move theme-specific light-DOM requirements to an explicit preset; general Lit supports legitimate encapsulation. |
| `template-img-alt`              | Keep accessibility objective; parse template markup and exclude commented images.                                |
| `template-no-autofocus`         | Keep deliberate focus policy; handle Lit boolean attributes such as `?autofocus=${true}`.                        |
| `template-no-positive-tabindex` | Keep; match the actual attribute, not data-tabindex or substrings.                                               |

Share one template-markup adapter with source-offset mapping across these rules instead of three independent regular expressions.

### 17. oxlint-plugin-shopify-app — 8 rules

| Rules                             | Disposition                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-asset-api-theme-writes`       | Fix method/operation detection: an Asset API GET is not a write. Document applicable platform category/exceptions and versioned evidence.                                 |
| `no-draft-order-custom-discounts` | Keep platform-specific policy only with operation/provenance detection; distinguish constructing arbitrary similarly named objects from issuing the prohibited operation. |
| `no-nav-emoji`                    | Keep narrow navigation scope; Unicode/token heuristics must not reject unrelated data strings.                                                                            |
| `no-script-tag-api`               | Keep applicable app-platform restriction with explicit scope and supported API forms.                                                                                     |
| `no-viewport-zoom-disable`        | Keep accessibility objective; parse actual viewport tokens and align semantics with theme conformance.                                                                    |
| `require-fetch-abort-signal`      | Fix undefined/spread bypasses. Distinguish an unproven options variable from a proven signal, and recognize Request-owned signals without claiming they prove a timeout.  |
| `s-modal-actions-use-slots`       | Validate allowed slot values/ownership; `slot="typo"` currently passes.                                                                                                   |
| `s-modal-heading-required`        | Check nonempty meaningful headings and supported dynamic values; attribute existence alone is weak.                                                                       |

### 18. oxlint-plugin-shopify-theme — 8 rules

| Rules                      | Disposition                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `custom-element-prefix`    | Configurable Theme OS namespace policy; account for aliased registration and string constants where supported.                           |
| `event-vocabulary`         | Share vocabulary with event-contract and generated examples. Constant exemptions need a corresponding constant validator.                |
| `feature-boundaries`       | Keep explicit architecture policy; resolve normalized paths and supported imports consistently.                                          |
| `lazy-hydration`           | Keep performance goal with explicit critical-feature exceptions. Coordinate dynamic imports with dependency enforcement.                 |
| `no-direct-cart-fetch`     | Keep owned-client policy; resolve actual cart requests rather than incidental strings.                                                   |
| `no-external-dependencies` | Fix dynamic-import bypass; distinguish dependency policy from measured shipped-byte budgets.                                             |
| `no-inline-style-write`    | Policy with exceptions for legitimate dynamic coordinates/custom properties if the product needs them; define the actual token contract. |
| `require-module-or-iife`   | Keep intended global-scope protection; define where classic scripts and module build outputs are expected.                               |

### 19. oxlint-plugin-type-evidence — 10 rules

| Rules                                       | Disposition                                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `no-chained-type-assertions`                | Keep as suspicious-cast detection with narrow, documented interoperability exceptions.                                                 |
| `no-known-value-widening`                   | Redesign around demonstrable evidence loss; move named-contract preference to a separate policy.                                       |
| `no-object-parameters`                      | Scope broad object rejection; permit meaningful generic constraints and explicit validation boundaries.                                |
| `no-runtime-typeof`                         | Remove from a general safety recommendation. Safe boundary refinement is useful; a schema-only architecture can expose this as policy. |
| `no-unknown-parameters`                     | Permit decoding/transport boundaries; unknown is preferable to pretending untrusted input is already typed.                            |
| `no-unknown-returns`                        | Fix recursive traversal; distinguish deliberate raw-boundary results from forgotten domain typing.                                     |
| `no-unknown-type-aliases`                   | Tighten to evidence-free aliases without forbidding useful recursive/generic/boundary models by spelling.                              |
| `no-unsafe-dictionary-type`                 | Keep suspicion of unbounded bags; allow actual dictionaries and validators with documented owner contracts.                            |
| `no-widen-then-assert`                      | Keep when same-value flow is established; use scope identity and avoid merely matching names.                                          |
| `require-safety-comment-for-type-assertion` | Policy. Require a meaningful invariant at exceptional casts rather than rewarding token comments; do not describe a comment as proof.  |

### 20. oxlint-plugin-xstate — 3 rules

| Rules                          | Disposition                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `machine-naming`               | Configurable traceability policy; remove generic oio default. Decide whether missing IDs should be allowed instead of only validating present ones.                            |
| `require-event-satisfies`      | Fix unrelated `.send` false positives. Contextual typing may already check the event; syntactic satisfies, especially satisfies unknown, is not proof of the right event type. |
| `require-setup-create-machine` | Keep versioned API policy; improve namespace/shadow/declaration-order handling while retaining existing alias support.                                                         |

### 21. stylelint-plugin-shopify-theme — 5 rules

| Rules               | Disposition                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `breakpoint-tokens` | Restrict dimensional breakpoints; allow reduced-motion, other accessibility/media capabilities, and print. Validate missing/empty configuration semantics. |
| `logical-props`     | Keep internationalization objective; report-only where physical coordinates may be intentional.                                                            |
| `no-root-margin`    | Fix nested @media and mixed selector lists; a root selector remains a root selector in those contexts.                                                     |
| `token-only`        | Parse values and handle relevant shorthands. Raw background color currently passes; valid `var( --theme-color)` fails.                                     |
| `z-scale`           | Keep configured stacking policy with clear units, token forms, and intentional escape handling.                                                            |

## Engineering improvements and missing pieces

### Strengthen the gate before growing the inventory

1. Add source/test typechecking and real-runner preset smoke tests to `pnpm check`.
2. Add adversarial fixtures: comments, aliases/shadowing, alternate API forms, Windows paths, null/invalid JSON, nested CSS/Liquid, cyclic types, and multiple independent constructs in one file.
3. Add consumer installation tests against packed artifacts. A dry-run pack of type-evidence includes dist/README/package.json but no LICENSE. Include license text in published packages and assert export/type resolution outside the monorepo.
4. Generate a rule/check catalog and assert registration, tests, README entry, metadata, and changeset policy. The root README omits conformance-core and type-evidence; theme READMEs substantially under-document their registered rules/checks. Greppable attribution tags exist, but README concept credits need reconciliation with AGENTS.md.
5. Add supported-version matrices where peers/API recognition are broad. CI currently tests one Ubuntu/Node combination despite Windows shell/path logic and changing plugin APIs. Replace the `@latest` workspace override with a deliberately updated version/range and lockfile policy.

These should be executable checks, following the repository's “prose is the last resort” principle. CONTRIBUTING/SECURITY and release/compatibility guidance would still be useful public-interface documentation; they should explain the workflow rather than duplicate deterministic requirements.

### Improve abstractions where repeated failures justify them

The valuable shared units are small and concrete: import/call ownership, scope-aware binding lookup, safe JSON/TOML shape decoding, parsed template attributes with source positions, a normalized registry/project model, and process/result handling for conformance. Keep framework-specific semantics in their packages. Do not build a universal rule DSL or collapse all packages into a shared dependency that forces unrelated releases.

Remove repeated source lexers where the host already supplies an AST. Cache whole-file facts once per file, carry cycle guards through type traversal, and avoid repeated subtree scans. For conformance, read/parse shared files once per run and bound external tool execution. For tests, retain cheap unit cases and a smaller meaningful integration matrix instead of launching a process for every trivial assertion. Measure representative large files/projects before claiming performance gains.

### Make the toolkit prove its own integration

The highest-value missing feature is a small collection of reference consumer projects, not another prohibition. Include a pure TypeScript library, an Effect application on each supported major, a Lit/XState UI, a Shopify app, and a minimal valid theme. Each should install packed artifacts, enable the relevant presets, pass when valid, and fail with expected diagnostics when mutated. The oio-generated project should be one of these consumers.

Use official platform/compiler validators for authoritative contracts; reserve bespoke checks for missing project conventions. For evolving Shopify requirements, attach primary-source/version evidence and an acceptance fixture to each hard assertion. For agent rules, measure review usefulness and suppression reasons rather than simply counting prompts.

## Recommended delivery order

| Batch | Scope                                                                                                         | Exit evidence                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1     | Registry preservation, recursive traversal, malformed-input handling, unreachable agent rules, typecheck gate | Reproductions become permanent regressions; existing gate and new typecheck pass              |
| 2     | False positives and bypasses in Effect, scope ownership, platform parsing, CSS/media behavior, required skips | Actual-runner valid/invalid cases; no parser/plugin failures hidden by helpers                |
| 3     | Product preset boundaries, type-evidence policy, duplicate ownership, shared budgets/configuration            | Generated catalog with explicit rationale/defaults/exceptions and passing consumer fixtures   |
| 4     | Artifact/release matrix, documentation generation, targeted caching and process improvements                  | Packed install/license smoke tests, compatibility CI, representative performance measurements |

Avoid a repository-wide rewrite. Ship bounded changes with regression tests and changesets, keeping policy changes separate from detection fixes so consumers can understand the behavior change.

## Validation and evidence

- Baseline `pnpm check`: **passed** build, lint, formatting, and **761 tests in 150 files** across the workspace.
- Supplemental core `tsc --noEmit`: **failed**, as described above. The baseline's success is therefore not a source-typecheck guarantee.
- Actual oxlint, agentlint, stylelint, conformance, and CLI probes found the documented defects. They ran against isolated fixtures under `.tmp/repo-review-fixtures`; no existing registry or application data was mutated.
- [Main probe script](../../.tmp/repo-review-probes.mjs), [results](../../.tmp/repo-review-probes.json), [agent runner script](../../.tmp/repo-review-agent-probes.mjs), [agent results](../../.tmp/repo-review-agent-output.json), [extra script](../../.tmp/repo-review-extra-probes.mjs), [extra results](../../.tmp/repo-review-extra-output.json), and [test inventory](../../.tmp/repo-review-test-inventory.txt) retain the local evidence. These audit scripts are not proposed production tests; turn the relevant cases into maintained package tests when fixing each finding.
- Review boundaries: no production deployment, no source fixes, no exhaustive Shopify certification, no performance benchmark, and no claim that every supported upstream version was executed.

The product direction is settled: opinionated defaults for your projects, with review and recommendations before implementation. The remaining policy choices concern which conventions apply across every project versus particular architectures. The confirmed correctness defects can be fixed independently of those choices.
