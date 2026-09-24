---
name: code-review
description: Review a diff, branch, or PR for consequential defects, missing evidence, and compatibility risks. Use when the user asks for review or independent assessment; not for ordinary implementation.
---

# Code Review

Report defects that change outcomes; separate them from preferences and open questions.

## Scope

- PR → compare the intended branch range, not just the working diff.
- Inspect unfamiliar scripts before running them, especially from untrusted branches.
- Tool-found defects still go in the review. Report unrun checks as unrun.

## Trace

- Follow changed values through parsing, auth, state updates, external calls, cleanup, outputs. Probe empty, repeated, partial-failure, cancellation, concurrency cases.
- Check exports, dependency ranges, generated files, migrations against real consumers; green workspace builds hide broken installs.
- Challenge abstractions only on concrete cost (duplicated ownership, hidden dependency, inconsistent errors, unreachable branch), never on length or taste.
- Would tests catch it? Fakes can share the implementation's wrong assumption; snapshots hide interactions. See [testing](../testing/SKILL.md), [test-strategy](../test-strategy/SKILL.md).

## Findings

- Falsify each via caller, invariant, or minimal repro. Drop contract-excluded hypotheticals; state blocked uncertainty.
- Format: location, trigger, consequence, fix direction. Rank by impact × likelihood; no quota.
- Return findings only; fix only when authorized.
- None found → state scope and gaps; never certify.
- Recurring issue → name the rule, check, test, or skill that should own it. One finding doesn't justify a new rule.
