---
name: code-review
description: Review a diff, branch, or PR for consequential defects, missing evidence, and compatibility risks. Use when the user requests review or independent assessment; ordinary implementation does not require a separate audit.
---

# Code Review

Find defects that change the user's outcome. Base each finding on a concrete path through the code, with a consequence and a repair direction. Distinguish defects from preferences and unresolved questions.

## Establish the scope

Read the request, applicable instructions, comparison base, and working tree. Inspect the changed code and enough surrounding behavior to understand its callers and contracts. For a PR, compare the intended branch range; the current working diff may show only part of the change.

Discover the existing checks before running them. Inspect commands and repository code before executing unfamiliar tooling, particularly from an untrusted branch. Use focused checks that can test a hypothesis, and run the required review gate when applicable. Existing valid evidence can be reused when the revision and configuration still match.

A tool's finding is evidence to evaluate, not a reason to omit the issue from the review. Include material confirmed defects even when automation discovered them. Separate advisory review prompts from mechanical failures, and report an unavailable or unrun check accurately.

## Trace consequential failures

Follow changed values across the boundaries where they matter: parsing, authorization, state updates, external calls, cleanup, and public outputs. Investigate relevant empty inputs, repeated calls, partial failures, cancellation, or concurrent updates when the changed contract makes them plausible.

Compare public exports, dependency ranges, generated files, and migration behavior with their real consumers. A successful workspace build can leave a package installation or runtime boundary broken.

Question an abstraction when it creates a concrete maintenance or behavior cost: duplicated ownership, a hidden dependency, inconsistent error policy, or a branch that cannot be exercised. File length, a preferred naming style, or the presence of a wrapper is not sufficient evidence by itself.

Assess whether tests would detect the suspected failure. A fake can share the implementation's mistaken assumption; a passing snapshot can hide an important interaction. Read [testing](../testing/SKILL.md) when reviewing assertion quality, or [test-strategy](../test-strategy/SKILL.md) when a substantial evidence gap warrants an audit.

## Validate each finding

Try to falsify a suspected defect by checking the caller, an existing invariant, or a minimal reproduction. Avoid reporting a hypothetical problem already excluded by the contract. State remaining uncertainty when verification is blocked; do not invent precision.

Give a finding's location, triggering condition, user or system consequence, and fix direction. Rank by impact and likelihood, without imposing a quota. Cite the smallest useful source location and link reproduction evidence when it changes the reviewer's confidence.

Keep the requested mode: a review request normally returns findings. Fixes belong to an authorized implementation task; existing authorization for review-and-fix remains sufficient. Do not expand a narrow review into a repository rewrite.

## Report the result

Lead with material findings, followed by relevant verification and limits. When no actionable defect is found, say that with the inspected scope and any meaningful gap; do not turn absence of findings into certification.

If a demonstrated issue is likely to recur, identify an existing lint rule, conformance check, test, or narrow skill that could own it. Propose or implement that improvement according to the current task scope. A new rule needs examples where it fires and stays silent; a single finding does not automatically justify a new policy.
