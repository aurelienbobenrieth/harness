---
"@aurelienbbn/agentlint-plugin-core": minor
---

Add six judgment rules to `strictPreset`, each exported as `<name>` / `define<Name>` with its `<Name>Options` type:

- `core/test-expectation-drift` — the package's first change rule. Reports test files whose existing expectations were deleted, loosened, skipped or re-valued in a change (`assertion-removed`, `test-removed`, `matcher-downgraded`, `expectation-revalued`, `disabled`, `snapshot-rewritten`), with a verbatim-move discount. Its binding defaults to `authority: "human"` because the author of a change is the party tempted to accept it; pass `authority: "agent"` to opt out. The binding includes source files and `*.snap` so the engine keeps them in the change set.
- `core/expected-value-recomputed` — assertions whose expected value is computed from the same inputs as the call under test.
- `core/integration-test-owns-its-boundary` — files named or titled as integration tests that construct test doubles.
- `core/correlated-optional-state` — object types pairing a string-literal status union with two or more optional fields.
- `core/temporal-coupling` — classes usable only after an init call: "not initialized" guards, `name!:` fields filled outside the constructor, nullable fields filled by an init method.
- `core/test-exercises-project-code` — test files that import nothing from the project.

Consumers extending `strictPreset` get the six rules on upgrade; expect new findings on the first `agentlint check --all`.

Add six opt-in judgment rules, exported but outside every preset until calibrated: `core/isomorphic-mapping` (`isomorphicMapping`), `core/flag-forked-function` (`flagForkedFunction`), `core/property-test-opportunity` (`propertyTestOpportunity`), `core/fake-parity` (`fakeParity`), `core/validation-discards-proof` (`validationDiscardsProof`) and `core/pinned-suspect-output` (`pinnedSuspectOutput`).

Amend two existing rules. `core/abstraction-earns-keep` (standard revision 2, detector version 2) counts implementers and forwarding members instead of reading names: single-implementer behaviour-only interfaces, `Impl`-style affixes, forwarding classes and forwarding modules, with options `minForwardingMembers` and `forwardingRatio`. `IName`/`...Interface` names are no longer reported unless `interfacePattern` is set. `core/test-behavior-coverage` (revision 3, version 3) adds the `interaction-only` and `snapshot-only` triggers with options `minInteractionShare` and `maxInlineSnapshotLines`. Existing acceptances for both rules need a fresh review.
