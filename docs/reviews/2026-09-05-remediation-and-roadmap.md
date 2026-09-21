# Review remediation and improvement roadmap

The [current readiness evidence](2026-09-05-readiness.md) supersedes historical dependency versions and compatibility results below. This document preserves the original review checkpoint and remaining roadmap.

The subsequent [roadmap implementation](2026-09-05-roadmap-implementation.md) records the completed consumer-evidence work and its remaining boundaries. Test counts and verification below describe the original remediation checkpoint, not the later working tree.

The working tree now addresses the reproduced review failures and tightens the surrounding contracts. Defaults remain opinionated for these projects. oio remains a draft. The next investment should be stronger consumer evidence and explicit coverage, followed by selected new capabilities—not a larger rule count by itself.

This follows [the original review](2026-09-05-repository-review.md), which is preserved as a historical record. The scope includes the pre-existing uncommitted work. No release, deployment, or commit was made. The generated inventories in all package READMEs cover **21 packages, 104 rules, and 38 conformance checks**. A passing static check is not a claim of complete semantic, browser, accessibility, or platform compliance.

## Implemented corrections

| Review concern                                | Result                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid registry overwritten                  | oio decodes registry entries, rejects malformed JSON/rows/IDs, preserves entry metadata, validates inputs before mutation, and uses exclusive creation plus atomic individual replacement. Scaffold/docs prepare write plans and attempt rollback on later write failure.  |
| Unreachable agent rules                       | Exported interfaces/types use the real enclosing export node; Liquid path matching accepts absolute runner paths. A real agentlint CLI consumer exercises every agent plugin with positive and negative fixtures.                                                          |
| Recursive types crash linting                 | Recursive alias queries carry their visited state; direct/mutual recursion is tested. Widening/reassertion checks now identify lexical bindings rather than sharing name-only state.                                                                                       |
| Invalid conformance input crashes             | Schema, template, registry, event, and locale-related structures receive shape validation before semantic traversal. Damaged examples receive findings instead of being treated as valid empty inputs.                                                                     |
| Effect rules miss preset idioms               | Named curried fn bodies, aliases in updated call recognizers, data-last forEach concurrency, ignored logs/pipelines, and current error APIs are handled. Error channels/mappers use AST nodes rather than miniature source parsers.                                        |
| Green gate does not typecheck source          | All 21 packages run tsc --noEmit as part of pnpm check. Build success is no longer a substitute for source type correctness.                                                                                                                                               |
| Helpers accept a parser/plugin failure        | Oxlint helpers check exit status, diagnostic structure, stderr, and expected rule findings. Stylelint helpers reject unrelated/parser warnings. Temp fixtures are cleaned up.                                                                                              |
| Spelling mistaken for ownership               | XState setup/send checks use imports and bindings; Effect service rules use explicit service ownership/projections; array policy requires visible array evidence; mutation policy parses GraphQL and REST methods.                                                         |
| Type policy rejects useful boundary evidence  | Known populated contracts are allowed. Unknown input/returns/aliases and dictionaries have explicit boundary-file exceptions; typeof refinement of unknown inputs is allowed by default. Cast comments need a non-placeholder explanation but remain review evidence only. |
| Performance/accessibility incentives conflict | Logs cannot float; eager images are not all promoted to high priority; lazy/high-priority conflicts are rejected. Semantic landmarks and actual template attributes are parsed. Callback arities, spies, motion media queries, and legitimate zoom limits are permitted.   |
| Presence sold as conformance                  | HTML, CSS, TOML, GraphQL, schema, template and event checks use structural parsing where introduced. Remaining dynamic/static limitations are explicit. Required output placement, input IDs, actual signal properties, and locale value types are checked.                |
| Required gates silently skip                  | Required Knip/jscpd modes fail on missing tools or unusable output. Optional skips are printed even in passing Vitest tests. CSS probes require an explicit builder; Windows shell shims are rejected.                                                                     |
| Overlap and configuration drift               | SEO/meta, surface/preset/docs, and static/contextual ownership are separated. Runtime matching is shared. Theme budgets/event prefixes have one generated, checked policy source. List replacement and independent config clones allow consumers to remove defaults.       |
| Published package confidence                  | Every package has license/repository metadata. An isolated tarball install checks all public exports, consumer type use, READMEs/licenses, and the oio executable. CI is configured for Linux/Windows and Node 22/24.                                                      |

## Package-by-package disposition

| Package                         | Decision and implementation                                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| agentlint-plugin-core           | Keep the six judgment-oriented prompts. Bound work to enclosing operations, avoid cardinality claims based on cursors, align test-quality guidance, and preserve useful unit/invariant documentation. |
| agentlint-plugin-effect         | Fix parser reachability. Runtime schemas are boundary ownership; internal compile-time contracts can be valid exceptions.                                                                             |
| agentlint-plugin-lit            | Separate deterministic light-DOM preference from preservation/focus/form review. An explicit render root no longer suppresses that review.                                                            |
| agentlint-plugin-shopify-app    | Review each form, including self-closing forms. Add locale-file scope and stable configurable regex behavior. Authentication/copy/network findings remain contextual.                                 |
| agentlint-plugin-shopify-theme  | Fix path handling, retain contextual fallback/lifecycle/motion/UX review, align event guidance, and assign structural presence/drift checks to conformance.                                           |
| agentlint-plugin-tanstack-query | Anchor state coverage to UI hooks. Include suspense hooks and surrounding boundary ownership; avoid duplicate findings at shared queryOptions definitions.                                            |
| agentlint-plugin-xstate         | Review failure per invocation; pure machines do not require manufactured failure states. Keep lifetime and derived-context questions contextual.                                                      |
| conformance-core                | Enforce required tools, show optional skips, scope overlap per manifest, remove framework-specific CSS builder defaults, and parse exact selectors.                                                   |
| conformance-shopify-app         | Parse deployment manifests and executable markup. Identify checkout targets, require builds, count recursive dist JavaScript, and resolve translations to owned strings.                              |
| conformance-shopify-theme       | Separate platform and Theme OS modes; validate shapes, nested presets and references; parse markup/styles; resolve event constants; correct image/contrast/locale policy and duplicate ownership.     |
| oio                             | Harden draft input handling, metadata preservation, prepared writes, rollback, locale scaffolding, and Lit content preservation. Keep skeleton status and explicit draft limits.                      |
| oxfmt-config                    | Add replaceLists and clone returned nested state.                                                                                                                                                     |
| oxlint-config                   | Preserve opinionated defaults; disable automatic nursery adoption; remove blanket assertion disables; add list replacement and nested isolation.                                                      |
| oxlint-plugin-core              | Use AST public-return analysis, exempt callbacks, handle forward/local exports correctly, permit spies by default, and evaluate assertions per test. Keep no-let optional.                            |
| oxlint-plugin-effect            | Replace fragile error/source recognizers, support intended composition forms, scope service/array policies, share runtime boundaries, tighten visible fail values, and preserve crypto requirements.  |
| oxlint-plugin-lit               | Parse Lit template HTML and actual alt/autofocus/tabindex attributes. Describe light DOM as project architecture.                                                                                     |
| oxlint-plugin-shopify-app       | Distinguish operations from matching words, read vs write, and response vs input. Tighten cancellation, modal, and viewport contracts.                                                                |
| oxlint-plugin-shopify-theme     | Include dynamic dependencies and cross-feature imports/re-exports; resolve same-file event/element constants; centralize event defaults.                                                              |
| oxlint-plugin-type-evidence     | Terminate recursive analysis, preserve useful structural and boundary contracts, and use lexical identity for flow-related diagnostics.                                                               |
| oxlint-plugin-xstate            | Remove the generic oio ID default and resolve setup/send API ownership. Keep explicit satisfies as syntax policy, not proof of the correct event type.                                                |
| stylelint-plugin-shopify-theme  | Permit nondimensional media queries, enforce nested/mixed root margins, cover background shorthand, and accept var whitespace.                                                                        |

The manually maintained duplicate rule lists are superseded by generated registration inventories. Package migration sections document concrete options and behavior changes. Existing opinionated policies such as root imports, named contracts, no-switch, feature islands, light DOM, and token styling were retained deliberately; they are not described as universal correctness or performance improvements.

## Verification and practical limits

`pnpm check` builds, checks source types, lints, formats, runs **840 tests across 154 test files**, and checks generated policy/catalog output. The catalog verifies exported rule folders, regression-test files, descriptions, artifact paths, package metadata, and credited concepts. It does not prove that every test is a meaningful behavioral assertion; actual-runner fixtures supply stronger evidence for representative cases.

`pnpm test:package` packs all 21 packages, installs them outside the workspace, imports all 25 public export entrypoints in a real test runner, checks consumer API usage, verifies LICENSE/README inclusion, and runs oio help. This catches missing artifacts and reliance on workspace links. It is a smoke test, not exhaustive execution of every API from every tarball.

Two upstream declaration defects were reproduced with full dependency checking: Vite Plus 0.2.1 references unavailable optional declaration modules, and Effect 4.0.0-beta.85 references SchemaErrorTypeId in an internal declaration. The consumer script allows only those known diagnostic locations/codes, prints the limitation, then checks consumer code with skipLibCheck. Unexpected errors still fail. `HARNESS_STRICT_DEPENDENCY_TYPES=1` audits without that allowance. This is a documented dependency limitation, not a claim that upstream declarations are clean.

The isolated consumer explicitly pins its tested Vite/tool versions: resolving a newer Vite in a fresh install exposed an unavailable transitive package. The repository lockfile protects its own development install; compatibility ranges still require ongoing testing. Node/OS CI jobs were configured, but only actually executed environments may be reported as passed.

Static Liquid inspection does not render templates or follow all dynamic branches. Opaque imported errors, runtime-generated event names, arbitrary wrappers, external type aliases, GraphQL variable payloads, browser request lifetimes, and deployed Shopify acceptance still require additional evidence. Checkout size is a conservative recursive raw-JavaScript total, not a bundler entry graph or transfer-size measurement. The [Shopify checkout extension API reference](https://shopify.dev/docs/api/checkout-ui-extensions/latest) currently documents a 64 KB deployment limit; the CLI remains the authority on deployable output and API-version rules.

oio write recovery is not a database transaction: a process crash can interrupt a multi-file plan, concurrent edits can prevent safe rollback, and newly created empty directories can remain after rollback. The implementation surfaces failures and avoids silently replacing malformed input, but production readiness needs a separate acceptance bar.

## What to improve next

This is a broad backlog, not an instruction to build every item or a claim that every addition earns its maintenance cost. **P1** closes a trust/coverage gap; **P2** adds substantial capability; **P3** is useful only after real consumers justify it. S/M/L indicate approximate relative scope. Each item includes an acceptance condition so proposals can become reviewable work.

### Product contracts and scope

1. **P1 / M — Machine-readable coverage contracts.** Add per-rule owner, policy/correctness/review classification, supported API versions, aliases/import forms, boundary exceptions, and known dynamic cases. Generate docs and check configuration schemas from that data. Accept when unsupported examples are explicitly distinguished from valid silent examples.
2. **P1 / M — Real-consumer policy presets.** Publish named Node/Effect, browser/Lit, Shopify app, and Theme OS combinations tested together. Preserve personal defaults while making intentional exceptions reviewable. Accept when each preset has one realistic clean fixture and one deliberately broken fixture.
3. **P1 / M — A coherent escape contract.** Standardize boundary paths, generated-file exclusions, and intentional policy exceptions without creating universal ignore magic. Require owner/reason only where meaningful. Accept when the same documented exception behaves consistently across relevant packages.
4. **P2 / M — Diagnostic ownership matrix.** Record which layer owns presence, syntax, type evidence, rendered behavior, and judgment for every overlapping topic. Accept when a consumer sees one primary diagnostic per defect, with complementary context rather than repeated instructions.
5. **P2 / S — Default-change policy.** Treat newly enabled warnings, stricter options, and reduced exceptions as consumer-visible changes even before 1.0. Link each to migration examples and a changeset.
6. **P2 / M — Coverage status in conformance output.** Return evaluated/skipped/unsupported/failed status separately from findings. Accept when a report cannot be interpreted as full compliance if required evidence was unavailable.
7. **P3 / M — Adoption profiles.** Support baseline existing debt and ratchet new violations without permanent blanket disables. Accept when removed debt cannot silently reappear and baseline entries expire when code changes.

### Test evidence and release engineering

8. **P1 / M — Consumer fixtures for every rule's risky syntax.** Extend beyond one smoke per plugin: shadowed globals, aliases, namespace imports, comments, multiline/generic forms, malformed input, re-exports, and nested scopes. Acceptance is correct diagnostics through the real runner, not mocked visitor shape.
9. **P1 / M — Combined-rule regression projects.** Test that one rule's prescribed fix does not violate another. Include boundary decoding, Effect error mapping, optional capabilities, cancellation, per-test spies, and dynamic theme events.
10. **P1 / M — Generated-project acceptance.** For every oio scaffold kind, compile, lint, render where appropriate, run conformance, and execute its generated tests in a real minimal consumer. A skeleton can lack business behavior while still having valid generated contracts.
11. **P1 / M — Release artifact API fixtures.** Add representative function/config uses and expected type errors to the isolated install, beyond import/export existence. Include conformance Vitest registration and actual oxlint/stylelint/agentlint invocation from tarballs.
12. **P1 / M — Compatibility matrix by tool version.** Exercise minimum supported and current pinned versions of oxlint, agentlint, Stylelint, Vitest, TypeScript, and Effect. Narrow peer ranges where evidence does not support them.
13. **P2 / M — Mutation testing for critical recognizers.** Start with recursive guards, shadow resolution, safe autofixes, required-tool failures, and rollback. Accept when disabling a critical branch causes an intended regression to fail.
14. **P2 / M — Property tests for parsers and path matchers.** Generate nested types, malformed records, escape characters, Windows/Unix paths, and cyclic registry references. Assert termination, bounded work, and deterministic findings.
15. **P2 / S — Reproducible issue fixtures.** Add a small CLI that captures tool versions, minimal source, relevant options, and diagnostic output with source content explicitly selected by the user. No automatic upload.
16. **P2 / M — Artifact policy checks.** Add publint/Are The Types Wrong when their dependency compatibility is stable; check size changes and accidental bundled dependencies. Avoid allowing a release tool to install floating versions silently.
17. **P2 / S — Release provenance and security process.** Document trusted publishing, provenance, rollback/deprecation, and a private vulnerability-report channel once configured. Test release preparation without publishing.
18. **P3 / M — Nightly dependency canaries.** Test newer tools without changing production defaults. Accept when canary failures produce bounded upgrade work rather than destabilizing the main gate.

### Shared analysis and performance

19. **P1 / M — Binding recognition as a tested contract.** Extend the proven helper pattern to remaining rules that still use documented names. Include direct imports, aliases, namespaces, local shadows, and import-before/use-before ordering. Do not treat syntactic fallback as semantic proof.
20. **P1 / M — Type-query memoization.** Cache completed alias queries per file while retaining cycle guards. Add lexical alias identity where declaration shadowing matters. Accept stable behavior on recursive union/container graphs with measured worst-case bounds.
21. **P2 / M — One filesystem inventory per conformance run.** Share a bounded immutable snapshot of discovered files and reads. Invalidate it between runs; never keep stale project state in module globals.
22. **P2 / M — Parse once, run checks many times.** Cache parsed Liquid schema/markup, CSS, TOML and event programs in a run context. Keep original paths and source ranges for findings. Compare total wall time and peak memory on a large fixture.
23. **P2 / M — Benchmark by rule and phase.** Measure discovery, parsing, semantic work and diagnostic formatting. Add representative large files and repository trees. Set budgets only after stable repeated measurements.
24. **P2 / M — Bounded concurrency.** Parallelize independent reads/checks behind a configurable limit, while keeping output sorted and file writes ordered. Avoid unbounded Promise.all over an entire theme or repository.
25. **P2 / S — Cancellation propagation.** Let conformance callers cancel tool processes and long analysis. Confirm cancellation cleans temp files and does not publish partial reports as success.
26. **P3 / L — Incremental execution.** Track changed files and dependency edges so only impacted checks rerun. Add this only after a reliable full-run baseline; stale caches are worse than slower truthful checks.
27. **P3 / M — Shared test infrastructure package.** Extract runner and fixture helpers only after their common contract stabilizes. Keep tool-specific failure semantics local; do not build a generic framework around unrelated visitor APIs.

### Core and type-evidence rules

28. **P1 / M — Full public-export analysis.** Follow export lists, aliases, default identifiers, overloads and package entrypoints for named public-return policy. Keep nested helper returns outside public API ownership.
29. **P1 / M — Remaining assertion ownership.** Resolve aliased Vitest expect/test/vi imports and custom registered assertion helpers. Distinguish property assertions, snapshots, interaction contracts and no-throw statements per test, including parameterized tests.
30. **P2 / M — Explicit dictionary ownership.** Support schemas/validators and bounded key unions for legitimate dictionaries rather than requiring filename exceptions alone. Accept real decoder and localization dictionaries while rejecting unbounded internal bags.
31. **P2 / M — Compiler-backed evidence mode.** Optionally ask TypeScript about actual evidence loss and event/error assignability. Keep the cheap syntax mode clearly named; measure program initialization cost before making typed mode default.
32. **P2 / M — Assertion-invariant review.** Add an agent prompt that checks the stated SAFETY invariant against the producer and use. The deterministic comment gate should only enforce a non-placeholder explanation, never award a safety certificate.
33. **P2 / S — Public entrypoint exceptions.** Define package-facade exceptions from package exports where practical, instead of relying only on index.ts spelling. Test exported subpaths and intentionally internal barrels.
34. **P3 / M — Complexity-aware advice.** Detect repeated copying inside loops only where its growth is demonstrable. Avoid replacing local mutation with O(n²) expression patterns to satisfy a preference.

### Effect and XState

35. **P1 / M — Error schema identity.** Verify visible tagged error constructors, discriminants, aliases, and mapper return contracts. Treat opaque external errors as unknown coverage instead of assuming that any constructor is a domain error.
36. **P1 / M — Serialization boundary identity.** Track Schema JSON pipelines, immediate decoders, generic wrappers and their exception handling. Add explicit debug/fingerprint serialization exceptions where those are actual project requirements.
37. **P1 / M — Effect runner/lifetime completeness.** Share provenance for every supported Effect/Layer runner, including aliases and namespace forms. Model configured entrypoints and scope ownership consistently.
38. **P2 / M — Resource acquisition review.** Add targeted checks for resources/listeners/subscriptions acquired without a corresponding scoped release, anchored to known APIs. Preserve legitimate externally owned lifetimes.
39. **P2 / M — Retry and idempotency contracts.** Review retried writes for idempotency keys, retryable error classification, jitter and budgets. Do not infer safety from the presence of a retry helper.
40. **P2 / M — Clock/random service ownership.** Resolve aliases from node:crypto and browser globals, including secure generators. Make the prescribed replacement preserve cryptographic requirements and test determinism.
41. **P2 / M — Service graph evidence.** Follow known service projections/declarations before suggesting constructor removal or layer flattening. Distinguish independent layers from dependent composition and avoid duplicate layer diagnostics.
42. **P2 / M — XState event union validation.** Compare sends/raises to the owning actor's event union in typed mode. Include actor refs passed through props and services; syntactic satisfies alone is insufficient.
43. **P2 / M — Machine traceability options.** Offer requireId with constant/alias support for projects that need stable telemetry IDs, while preserving the current explicit choice to allow omitted IDs.
44. **P2 / M — Actor lifetime scenarios.** Test invoked, spawned, root, injected and component-owned actors, including repeated mount/unmount and failure. Make cleanup advice follow the actual owner.
45. **P3 / M — Transition tests from contracts.** Generate suggested failure/retry/cancellation scenarios from machines, without pretending generated tests replace domain assertions.

### Shopify app tooling

46. **P1 / M — Selected deployment configuration.** Add an explicit environment/manifest selector and report the evaluated manifest. Do not require unrelated local development configurations to satisfy deployment-only contracts.
47. **P1 / M — Served App Bridge evidence.** Add an optional browser/HTTP probe for the actual document head and script execution, including platform injection. Static root-file checks remain a fast preflight.
48. **P1 / M — Checkout entry graph budgets.** Consume Shopify/bundler output metadata, account for shared chunks per entry, distinguish raw/compressed sizes, and version the platform limit. Keep missing builds an explicit failure.
49. **P1 / M — GraphQL variable inputs.** Track literal request variables and generated documents to their mutation inputs. Avoid confusing response fields, type names, comments, and unrelated application objects with API writes.
50. **P2 / M — Cancellation and deadlines.** Resolve const RequestInit/Request objects, recognize abort composition and timers, and separately report unbounded duration. Test signals overridden through spreads and cancellation of retries.
51. **P2 / M — Authentication route ownership.** Review server token verification, audience/expiry, session storage and frontend token transport at the actual boundary. Never present a marker string as authentication proof.
52. **P2 / M — Dirty-form behavior.** Browser-test Save/Discard, navigation guards, failed saves, multiple forms and remounts. Save-bar presence alone is insufficient.
53. **P2 / M — Rendered copy inventory.** Associate JSX strings, translations and framework UI attributes with visible merchant copy; exclude keys, URLs, logs and irrelevant data. Keep factual urgency exceptions reviewable.
54. **P2 / M — Nested modal actions.** Resolve child components and dynamic slot/heading values where possible; test actual keyboard/focus behavior in a rendered app fixture.

### Theme, Lit and Stylelint

55. **P1 / L — Rendered theme acceptance fixture.** Render representative templates and sections, then test landmarks, heading hierarchy, no-JS use, translation output, forms and focus. Static file checks cannot establish composition correctness.
56. **P1 / M — Real LCP measurement.** Use a representative rendered page and network trace to identify the LCP candidate, priority, responsive source, dimensions and lazy-loading behavior. Keep performance budgets separate from naming policy.
57. **P1 / M — Alpha and dynamic contrast.** Evaluate actual rendered foreground/background pairs, including transparency and inherited colors. Record unevaluated pairs explicitly instead of producing confident ratios from unsupported values.
58. **P1 / M — Event graph completeness.** Validate constants against the declared vocabulary, distinguish dispatch from listener usage, support re-exported const contracts, and report unreachable/unresolved edges without false unused claims.
59. **P2 / M — Liquid parameter contracts.** Add scope-aware local assignment/loop/filter handling and a maintained platform-global vocabulary before flagging undocumented parameters. Validate render-call arguments against snippet contracts.
60. **P2 / M — Schema value domains.** Extend nested preset validation to platform resource settings, app blocks, nested block order, limits, defaults and available API versions. Prove restrictions with authoritative fixtures, not folklore.
61. **P2 / M — Locale families.** Handle fallback chains, plural rules, dynamic key families, rich text and schema/storefront separation. Validate every configured locale, not only defaults.
62. **P2 / M — Template reference graph.** Resolve section groups, nested blocks, preset references and reachability, with cycles and missing files reported once at the owning edge.
63. **P2 / M — Render-safe Lit scaffolds.** Test server child preservation through updates, reconnects and theme-editor section replacement. Add DOM-capable generated tests with declared environment dependencies.
64. **P2 / M — Lifecycle allocation pairs.** Match each event listener, observer, subscription, timer and actor to cleanup and lifetime ownership. Add reconnect scenarios and abort-controller reuse checks.
65. **P2 / M — Lit alias/base-class coverage.** Recognize import aliases, namespace usage, decorators and configured project bases through real-parser fixtures. Review inherited render/task behavior rather than guessing from class names.
66. **P2 / M — CSS value parsing.** Extend token policy to border/outline/background layers and supported CSS functions. Distinguish token-derived math from a token mixed with an unrelated raw color; preserve valid gradients, URLs and intentional geometry.
67. **P2 / M — CSS selector semantics.** Handle :is/:where, relative nesting, custom element roots and container queries with source locations. Keep style policy separate from computed layout/accessibility proof.
68. **P2 / M — Token graph.** Parse declarations/uses, fallbacks, aliases, cycles and multiple themes. Distinguish source tokens from emitted build artifacts and report actual missing dependencies.
69. **P2 / M — Hydration exceptions.** Model critical interactions, above-fold features and delayed work with explicit entrypoint metadata. Verify dynamic imports and network waterfalls rather than assuming all lazy loading improves UX.
70. **P3 / M — Aggregate page budgets.** Measure CSS/JS/font/image cost per rendered route and feature island in addition to per-asset limits. Avoid a budget that can be bypassed by splitting one large file into many small files.

### oio draft evolution

71. **P1 / M — Pure command plans.** Expose a machine-readable plan containing reads, creates, replacements, expected prior hashes and diagnostics. Add --dry-run and --json against the same plan used for execution.
72. **P1 / L — Durable write recovery.** Add a journal and recover/resume command if real use justifies multi-file crash recovery. Use expected-content checks/locking before overwriting shared registries; never overwrite a concurrent edit during rollback.
73. **P1 / M — Versioned registry/event schemas.** Put migration policy and schema versions in the contract; preserve unknown metadata deliberately and handle obsolete fields with explicit migrations.
74. **P2 / M — Unified registry schema package only when justified.** Share accepted schema/serialization between CLI, conformance and agents without pulling CLI/Effect dependencies into every consumer. Begin with shared fixtures and compatibility checks before creating a new public package.
75. **P2 / M — Scaffold configuration contract.** Support project layout, namespaces, locale conventions, DOM test environment and service/machine placement through validated options rather than template string edits.
76. **P2 / M — Actionable command failures.** Introduce stable error codes and path-specific diagnostics for parse, validation, conflict, permission and rollback failures. Test CLI exit codes as well as handler values.
77. **P2 / M — Documentation integrity.** Escape generated Markdown table cells/links, validate full event detail shapes, and verify relative documentation links. Do not generate a production claim from skeleton registry entries.
78. **P2 / M — Draft acceptance milestone.** Define the smallest supported real theme, run every command against it, capture recovery behavior and limitations, and only then reconsider a production-ready label.
79. **P3 / M — Interactive discovery.** Add helpful local diagnostics for missing config and supported scaffold kinds once command plans and errors are stable. Avoid a large wizard before the underlying contracts are dependable.

## Suggested order

First close remaining semantic coverage gaps with real consumer fixtures, typed/binding support, combined presets and generated-project acceptance. Next share filesystem/parsing work and measure it. Then invest in rendered Shopify/Lit evidence and entry-graph budgets. Keep oio draft until its planning, recovery and generated-project acceptance criteria are met.

For each proposed rule or abstraction, require one real recurring failure, a precise ownership boundary, a negative case that must stay silent, and a measurable acceptance condition. If the result is only a stronger preference or a new way to satisfy the tooling without improving the software, retain it as an explicit policy/review prompt or do not add it.
