---
name: toolsmith
description: Build or improve reusable scripts, scaffolds, smoke checks, and environment diagnostics that replace repeated manual work with reliable evidence. Use for recurring workflow friction or verification that needs executable tooling; a one-off command does not need a new framework.
---

# Toolsmith

Turn a demonstrated recurring failure or costly verification step into the smallest maintained tool that removes it. Inspect existing package commands, scripts, CI, and checks first; improve an existing owner when possible.

## Choose the mechanism

| Requirement                                       | Suitable mechanism                           |
| ------------------------------------------------- | -------------------------------------------- |
| Deterministic source syntax                       | Compiler or syntax-aware lint rule.          |
| Manifests, generated output, or repository layout | Conformance check or repository script.      |
| Runtime or external boundary behavior             | Focused integration or smoke test.           |
| Judgment requiring task context                   | Narrow review prompt or skill guidance.      |
| Repeated creation of known files                  | Scaffold with conflict checks and a preview. |

Keep temporary probes temporary when they only answer this task's question. Promote a helper when recurring value and maintenance ownership justify it within the authorized scope. Promotion does not require another approval when improving project tooling is already requested.

## Define observable behavior

Before implementing, identify inputs, allowed paths or targets, side effects, success evidence, and failure behavior. Reuse the project's runtime and dependency conventions. Prefer a single command to a new orchestration layer.

Make repeated execution safe for the intended operation. For writers, inspect conflicts before applying changes and offer a check or preview mode when consequences are useful to review. A preview must reflect the actual plan; verify relevant preconditions again before writing because files or remote state can change.

Bound retries, request counts, timeouts, and child-process lifetime when the tool uses them. Retry only when the operation's semantics make that safe; a lost response can follow a successful write. Distinguish a transient failure from invalid input or missing authorization. Report partial completion and recovery instructions instead of presenting a partial run as success.

Treat input as data. Pass command arguments without constructing shell code from input, use literal filesystem paths, and verify resolved paths stay inside the intended target before destructive operations. Account for symlink or junction escapes where paths can be supplied by callers. Protect existing files from accidental overwrite.

## Make evidence trustworthy

For a reusable CLI, provide concise usage and actionable failures. Return success only when the promised check or operation completed. Distinguish invalid configuration, a detected violation, a skipped check, and an unexpected tool failure; an empty input set must not silently certify coverage.

Offer structured output when another tool consumes it. Keep diagnostics separate from that output and redact credentials, private payload fields, and secret-bearing URLs. Include the inspected target and relevant version or configuration when those determine what the result proves.

An environment doctor should identify the missing prerequisite and its repair command. Run local repairs already authorized by the task when their side effects are understood. If repair requires unavailable access or an unapproved external mutation, explain that concrete blocker and continue independent work. Never hide stale generated contracts behind handwritten substitutes or widened types.

## Validate and keep it small

Exercise the normal use, a meaningful failure, and the recovery or rerun behavior the tool promises. For file writers, use isolated temporary fixtures to verify conflict preservation and preview behavior. For process runners, verify nonzero exits and cleanup. Choose additional cases from actual risks rather than a universal checklist.

Document the command at its established entry point and connect it to CI only when it is deterministic, affordable, and intended as a gate. Report the path, command, observed result, and material limit. Remove duplicate steps when the new tool replaces them; a tool that adds another manual ritual has not solved the problem.
