---
name: build
description: Implement an authorized feature, fix, or refactor test-first, with designs that stay deep, isolated, and small at their public surface. Use when changing code behavior, adding modules or exports, or reshaping boundaries. Not for explanation-only requests or unresolved requirements (see align). Use for requests to implement a function, fix input validation or other code behavior, add a new public export, or refactor a module into a smaller API, even when the requested change is small.
---

# Build

- Before editing: inspect the working tree (existing work survives); read validation commands/side effects from config. "Can you fix this?" = act; ask only outcome-changing or out-of-authorization questions; several open interdependent decisions: [align](../align/SKILL.md) first.

## Loop

1. **Contract:** trigger to outcome, from request/spec, before reading the implementation.
2. **Red:** one failing test per slice, oracle per [testing](../testing/SKILL.md); fails on the assertion, not a fixture.
3. **Green:** minimal code; tests read-only. Spec/test disagree: stop, report.
4. **Refactor** on green; structure and behavior in separate commits.
5. **Prove it:** doubt a green test: break the code, it must go red. Strategies by failure feared.

Defect: reproduce at its boundary, cheapest distinguishing observation first; no reproduction: name the missing condition, cause stays provisional. Covered, low-impact, reversible edit: no new test, still scoped checks.

At edited boundaries, list consumers and semantic exceptions. Abstract only a shared decision, not similar syntax. Shaping a module/export/package boundary: load [design](references/design.md).

## Verify

- Runtime limits, retry identity, cancellation, partial failure: design in when needed. Stale generated code: run the generator (check external sync); never hand-write/widen substitute types. Prove at the failure boundary: real filesystem, consumer install. Focus/typing/dialog changes: one bounded real-browser flow; retain command/result or screenshot, or state the runtime limit.
- Parallel workers: bounded scope, file ownership, verification task each, brief/budget per [economy](../economy/SKILL.md); serialize shared mutable state.
- Worktree servers: `worktree-hygiene ports`, strict port; handoff requires `worktree-hygiene done` exits 0 (`--reap` stops yours). Never stop a process by name/port alone.
- Skipped/empty/stale/unavailable is not a pass. Rerun invalidated checks. Scoped checks while iterating, then one full gate on the final state before handoff (PR or no PR), or CI per project; never parallel checks.

**Handoff:** behavior, checks + results, material limits. Never "done" with a failing check.

- `core/no-let`: use `const` and expression-based accumulation instead of mutable bindings.
- `core/no-multi-positional-parameters`: pass one named options object when a function needs multiple inputs.
- `effect/no-array-callback-reference`: pass an inline callback so array index arguments cannot reach another function.
- `effect/no-array-for-each`: use `for...of` for synchronous work and `Effect.forEach` for effects.
- `type-evidence/no-known-value-widening`: preserve the inferred concrete type instead of annotating known values as broad types.
- `type-evidence/no-runtime-typeof`: decode boundary values with a schema instead of branching on runtime `typeof`.
- `type-evidence/require-safety-comment-for-type-assertion`: precede the owning statement with a `// SAFETY: <invariant>` comment for each necessary assertion.

- `effect/prefer-effect-array-helpers`: use Effect array helpers for known arrays inside imported Effect runtime callbacks.
