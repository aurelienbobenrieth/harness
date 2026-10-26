---
name: toolsmith
description: Build scripts, CLIs, scaffolds, smoke checks, and environment doctors that are safe to rerun, exit honestly, and never escape their target. Use when writing or changing a reusable script or tool that replaces repeated manual work or fragile verification. Not for one-off commands, or for deciding which mechanism should own a problem (see retrospect).
---

# Toolsmith

Extend an existing script, CI step, or check.

- Unsure a script is the right owner: [retrospect](../retrospect/SKILL.md) routes it. Repeated file creation: scaffold with conflict check + preview. Before coding: fix inputs, targets, side effects, success evidence, failure behavior. No new orchestration layer.

## Safety

- Writers: check conflicts first, never overwrite silently; preview reflects the real plan; re-verify preconditions before writing. Partial run: report what completed + how to recover; never exit success.
- Bound retries, requests, timeouts, child-process lifetime. Retry only idempotent operations; a lost response can follow a successful write.
- Input is data: argument arrays, no shell strings from input. Before destructive ops, verify resolved paths stay inside the target, including symlink/junction escapes.

## Exit codes and output

- Exit 0 only when the promised check/operation completed.
- Distinguish invalid config, violation, skipped, crash, transient failure, missing authorization. Empty input set must not certify coverage.
- Machine output on stdout, diagnostics on stderr. Redact credentials, private payloads, secret URLs.
- Never mask stale generated contracts with handwritten/widened types.

## Validate

Test normal use, a meaningful failure, rerun/recovery (writers: temp fixtures for conflict preservation + preview; process runners: nonzero exits, cleanup).
