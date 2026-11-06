# AGENTS.md

Harness: source of truth for @aurelienbbn steering packages - lint rules, tool configs, and conformance checks that compound across projects.

<!-- harness:communication:start -->

## Communication

Always on. The user's requested depth, format and language win. Load the communication skill only for long documents.

```yaml
communication:
  scope: explanations only; no compression of code, tests, names, validation or design
  reset: concise each reply; requested depth lasts one turn
  size: minimum sufficient; target 60 words including visual labels, 20 for simple answers; exceed for necessary facts or requested depth
  prose: answer first; natural connected sentences
  simple: one direct sentence; corrections give changed fact and consequence only
  omit: preambles, established facts, recaps, menus, duplication, em dashes
  choose: states -> labelled text state chart; async -> text sequence/call tree; guards -> decision tree/table; simple fact -> prose
  layout: one readable idea per line; visual replaces prose; no dense cells or invented shorthand
  general-rule: when requested, give the complete rule before evaluating an example
  preserve: necessary values, units, negations, conditions, exceptions and uncertainty; caveat beside claim
  verify: retain decision-critical facts; never invent edges, order or causality; cut repetition before facts
```

<!-- harness:communication:end -->

<!-- harness:economy:start -->

## Economy

Always on, every task. Each call re-reads the whole context; anything in it is paid again on every later call.

- **Search, then read a range.** `rg -n`/Grep first, then the needed lines (offset/limit, `sed -n 'a,bp'`). Never `cat` a file over ~200 lines or several at once; never re-read what context holds.
- **Trim output at the source.** Failing tests only (`--reporter=dot`, fail-only flag), `git diff --stat` before the full diff. Capture exit status on the first run (`pipefail` with `tail`); never rerun a passing gate to recover it. Whole logs go to a file; read the failing part.
- **Check the changed scope.** Scoped checks while iterating; then one full gate on the final state before handoff (PR or no PR), or CI when delegated by the project. Run checks in that order, not in parallel.
- **Stay out of vendored trees.** Targeted `rg` with a path in vendored/generated trees, never a listing/full read.
- **Delegate only broad, independent work.** Under ~5 files or one question: inline. Delegated: brief + budget (load the economy skill). **Wait once, never poll:** block on the command or use the host's wait tool; no `sleep` loops.
- **Read around the named source.** Asked to write from a file: list its folder and read its neighbours first. A fact there that changes the answer goes in the output, with its source.

<!-- harness:economy:end -->

## Taxonomy

```text
*-config / *-preset  bundle existing rules into recommended combinations
*-plugin             define new rule implementations (oxlint, agentlint, stylelint)
conformance-*        structural checks over manifests, layout, build output
                     (Vitest suite or programmatic)
worktree-hygiene     CLI for agents in parallel worktrees: ports, leftover processes
```

Rules live in the narrowest reusable domain: `effect` for Effect-specific, `core` for stack-agnostic. Core packages stay strictly project-agnostic.

## Rule-authoring loop

Every new rule ships as one unit:

```text
rule folder    src/rules/<name>/rule.ts + rule.test.ts
registration   package index / preset
tests          positive (fires) AND negative (stays silent) cases
README         one entry: the rule and its trigger
changeset      always
```

Autofix only when exactly one safe mechanical rewrite exists, and it is tested. A fix that needs project knowledge reports only.

## Attribution law

- Never reproduce copyrighted or licensed work. When adopting an idea from elsewhere, re-implement it independently, in this repo's own design and words.
- Anything license-ambiguous stops here: raise it to a human before it lands.
- Every re-implementation carries a greppable JSDoc `@attribution <source> (<license/inspiration>)` tag.
- Credited concepts also get named in the package README.

Verify: `rg "@attribution"`.

## Skills

Load the matching skill before acting:

```text
README, ADR/PDR, PR text, reference doc     → communication
open requirements, ambiguous domain terms   → align
feature, fix, refactor, writing tests       → build
commit, history, push, PR                   → git
review a change                             → code-review
delegate, fan out, long autonomous run      → economy
same correction twice, recurring friction   → retrospect
Shopify app readiness                       → shopify-review
add Harness to a project                    → install-harness
```

## Style

- kebab-case names everywhere; oxfmt formats, don't fight it
- rule messages are assertive: the violation and the fix direction, no hedging
- no narration comments; comment every package as if it were OSS (public-interface docs discipline)

## Validation gate

Scoped checks while iterating; then `pnpm check` (build + lint + fmt:check + test) once on the final state before handoff, with or without a PR; CI may run it when delegated by the project.

## Prose is the last resort

A deterministic preference becomes a rule or check, not prose. This file carries only what no tool can.
