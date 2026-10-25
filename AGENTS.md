# AGENTS.md

Harness: source of truth for @aurelienbbn steering packages - lint rules, tool configs, and conformance checks that compound across projects.

<!-- harness:communication:start -->

## Communication

Always on, every reply, progress update, doc, ADR/PDR, JSDoc, commit, PR. The user's requested depth, format, or language wins. Long documents (README, ADR, PDR, PR) also load the communication skill.

- **Line one answers:** result, decision, or verdict. Then only what changes the reader's next move. No recap, no follow-up menu.
- **Size to the question.** A fact/ack gets 1-3 lines, no headings.
- **Show, then tell.** A table, `diff`, tree, `a -> b` flow, or real command output replaces any paragraph with the same facts; prose only connects them.
- **Every word changes what the reader knows or does; cut the rest.** ("Returns the session user, or `undefined` once the session expires", not "This function is used in order to retrieve the current user".)

- **Observed is not inferred.** "Passed locally" isn't "CI passed". Name what you didn't verify; never invent a number, run, example, or approval.
- **Plain punctuation, plain voice.** No em dashes (U+2014) or stand-ins; no canned openings, closings, or stock transitions.

<!-- harness:communication:end -->

<!-- harness:economy:start -->

## Economy

Always on, every task. Each call re-reads the whole context; anything in it is paid again on every later call.

- **Search, then read a range.** `rg -n`/Grep first, then the needed lines (offset/limit, `sed -n 'a,bp'`). Never `cat` a file over ~200 lines or several at once; never re-read what context holds.
- **Trim output at the source.** Failing tests only (`--reporter=dot`, fail-only flag), `git diff --stat` before the full diff, `| tail -n 40` on logs. A log needed whole goes to a file; read the failing part.
- **Check the changed scope.** Scoped checks while iterating; then one full gate on the final state before handoff (PR or no PR), or CI when delegated by the project. Run checks in that order, not in parallel.
- **Stay out of vendored trees.** Targeted `rg` with a path in vendored/generated trees, never a listing/full read.
- **Delegate only broad, independent work.** Under ~5 files or one question: inline. Delegated: brief + budget (load the economy skill). **Wait once, never poll:** block on the command or use the host's wait tool; no `sleep` loops.

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
feature, fix, refactor, new module/export   → build (with testing)
writing or judging tests                    → testing
commit, history, push, PR                   → git
review a change                             → code-review
delegate, fan out, long autonomous run      → economy
same correction twice, recurring friction   → retrospect
reusable script, CLI, scaffold, doctor      → toolsmith
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
