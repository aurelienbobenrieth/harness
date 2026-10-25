---
name: code-review
description: Review a diff, branch, or PR for defects that change outcomes and drift from what was asked, beyond what lint, agentlint, and tests enforce. Use when asked to review or before marking a non-trivial PR ready. Not for style preferences, or for fixing unless the task includes it.
---

# Code Review

- Gates first (`check`, agentlint `check`); report failures as-is, don't re-derive their coverage. Unrun checks reported as unrun. PR: intended branch range, not just the working diff.

## Two axes

**Asked?** Change vs request/issue/spec: missing behavior, unrequested behavior, silently changed contracts.

**Correct?**

- Follow changed values through parsing, auth, state, external calls, cleanup, outputs. Probe empty, repeated, partial-failure, cancellation, concurrent cases.
- Public surface vs real consumers: exports, dependency ranges, generated files, migrations. A green workspace build hides broken installs.
- Design: [build](../build/SKILL.md)'s rules, only on concrete cost (decision spread across modules, hidden dependency, pass-through layer, unreachable branch), never length/taste.
- Tests: would they catch the bug? Independent oracles, fakes that can't share the mistake: [testing](../testing/SKILL.md).

## Findings

- Falsify each via caller, invariant, or minimal repro first. Blocked: say what's uncertain. Format: location, trigger, consequence, fix direction. Rank impact x likelihood; no quota.
- Fix only when authorized. None found: state scope and gaps, never "looks good" as certification.
