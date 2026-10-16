# AGENTS.md

Harness: source of truth for @aurelienbbn steering packages - lint rules, tool configs, and conformance checks that compound across projects.

<!-- harness:communication:start -->

## Communication

Always on, for every reply, progress update, doc, ADR/PDR, JSDoc, commit, and PR. The user's requested depth, format, or language wins. Long documents (README, ADR, PDR, PR) also load the communication skill.

- **Line one answers:** the result, decision, or verdict. Then only what changes the reader's next move. Stop there: no recap, no follow-up menu.
- **Size to the question.** A fact or an ack gets 1–3 lines with no headings. Grow only when shorter would leave the reader unable to decide, act, or catch a mistake.
- **Show, then tell.** A table, `diff`, tree, `a ─▶ b` flow, or real command output replaces any paragraph carrying the same facts; prose only connects them. In JSDoc, an `@example` beats a sentence.
- **Every word changes what the reader knows or does; cut the rest.** These pairs show the move across contexts. They are not the list of phrases to hunt:

  ```diff
  - This function is used in order to retrieve the current user.
  + Returns the session user, or `undefined` once the session expires.
  - Made some changes to improve the way errors are handled.
  + fix: retry billing API 503s twice before failing
  - I went ahead and updated the configuration file as you requested.
  + Config updated: `retries: 3`.
  - After careful consideration of the options, we decided to move forward with Postgres.
  + **We use Postgres.** SQLite can't serve two writers.
  ```

- **Blocks of 1–3 sentences; headings state claims** (`## Locks are never stolen`, not `## Locking`).
- **Observed ≠ inferred.** "Passed locally" isn't "CI passed". Name what you didn't verify; never invent a number, run, example, or approval.
- **Plain punctuation, plain voice.** No em dashes (U+2014) or stand-ins for them; no canned openings, closings, or stock transitions.

<!-- harness:communication:end -->

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

`pnpm check` (build + lint + fmt:check + test) green before any work is called done.

## Prose is the last resort

A deterministic preference becomes a rule or check, not prose. This file carries only what no tool can.
