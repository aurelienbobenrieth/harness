# AGENTS.md

Harness: source of truth for @aurelienbbn steering packages - lint rules, tool configs, and conformance checks that compound across projects.

## Taxonomy

```text
*-config / *-preset  bundle existing rules into recommended combinations
*-plugin             define new rule implementations (oxlint, agentlint, stylelint)
conformance-*        structural checks over manifests, layout, build output
                     (Vitest suite or programmatic)
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

## Style

- kebab-case names everywhere; oxfmt formats, don't fight it
- rule messages are assertive: the violation and the fix direction, no hedging
- no narration comments; comment every package as if it were OSS (public-interface docs discipline)

## Validation gate

`pnpm check` (build + lint + fmt:check + test) green before any work is called done.

## Prose is the last resort

A deterministic preference becomes a rule or check, not prose. This file carries only what no tool can.
