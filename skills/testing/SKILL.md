---
name: testing
description: Write or review tests that detect meaningful behavior failures with readable, reproducible evidence. Use when editing tests, choosing a regression seam, or assessing whether existing assertions justify a claim; simple edits do not automatically need new tests.
---

# Testing

Start with the defect the test would catch. Keep a test when it protects an observable contract, a meaningful invariant, or a demonstrated regression. A test that computes its expected value with the same algorithm as the implementation supplies little independent evidence.

## Choose the boundary

Ask where the behavior can realistically break:

| Failure source                                             | Evidence to prefer                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Local decision or transformation                           | Focused examples with independently chosen outcomes.             |
| Law over many inputs                                       | A property with a bounded generator and reproducible failures.   |
| Database, filesystem, package loader, or service semantics | A contract or integration check against that boundary.           |
| User interaction                                           | Rendered behavior at the relevant browser or component boundary. |
| Environment configuration                                  | An explicit smoke check of that environment.                     |

Use [test-strategy](../test-strategy/SKILL.md) for a substantial suite audit or when choosing properties, state models, or mutation testing. Ordinary example tests do not require that extra workflow.

A fake demonstrates how the feature behaves under the fake's assumptions. Verify important assumptions against a real implementation or its authoritative contract. Captured responses can exercise parsing but cannot prove current authentication, pagination, delivery, or timing behavior. Record the boundary that remains unverified.

## Make the contract readable

Name the triggering condition and visible result: "a repeated request returns the first receipt without charging again." Use the project's vocabulary and established test organization. Keep fixtures close enough to understand, and extract setup when it obscures the behavior. Line counts and helper placement are not quality gates.

Assert the contract's important output fields and required absence of side effects. Exact equality suits closed value objects and payloads; targeted assertions suit extensible records or rendered interfaces. Include negative assertions when unwanted extra data, writes, or events are the failure mode. Neither whole-object equality nor partial matching is universally stronger.

Group assertions that describe one behavior. Use tables when cases share a rule and still produce identifiable failures. Keep cases separate when their setup or outcomes deserve separate explanations. Prefer observable results to internal call order; a boundary call, its payload, and its count can themselves be the contract.

For a new rule or validator, include inputs that should report and nearby valid inputs that should stay silent. For an autofix, verify the exact rewrite and that valid or ambiguous input is preserved. Follow additional repository rule-authoring requirements.

## Make failures useful

Control clocks, randomness, IDs, and ordering in unit tests. Await completion through the runner's supported primitives. Restore global state and dispose of resources even on failure. Use isolated temporary directories and avoid fixed shared ports or paths.

Integration tests may use real clocks, networks, and processes when those are what they verify. Give them explicit environment selection, finite timeouts, isolated data, and cleanup. Keep them discoverable separately from the fast local loop. Follow the existing authorization for any external mutation.

Property runs must preserve the seed and shrink path needed to replay a failure. A fixed seed is useful for a stable local loop; varying seeds are useful exploration when failures retain their replay data. Turn a useful discovered defect into a named regression case.

Confirm that a new regression test fails for the intended reason when practical. A test that fails because its fixture cannot load has not reproduced the behavior. Report zero selected tests, environment skips, and flaky retries separately from successful assertions; retries do not repair a flaky test.

## Review the evidence

Use coverage to locate unexamined behavior, then judge the risk at that location. A high percentage cannot establish correctness, and an uncovered branch is not automatically worth a test. Type checks can protect static contracts; they do not prove runtime data or published declarations work for consumers.

Before deleting a test, identify the unique failure it catches and whether another check actually preserves it. Temporary probes can become maintained tests when they protect a useful contract and meet the same standard. Avoid rewriting a working suite solely for preferred wording or layout.

Report what the executed tests establish and the material boundary they leave open. New tests are unnecessary when existing evidence adequately covers a reversible, low-impact change; complete the repository's required checks regardless.
