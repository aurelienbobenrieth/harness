# Steering skills

**Skills carry the judgment no check can make; anything deterministic belongs to lint, conformance, or tests.** A skill never restates a rule; it points at it. A SKILL.md body stays under 450 words: detail only some tasks need lives in `references/`, read on demand.

## How a skill gets used at the right moment

```text
session start ─▶ AGENTS.md: communication + economy rules + task → skill map ─▶ agent loads the matching skill before acting
                                                                   └▶ fallback: host matches the skill's description
```

| Layer                                       | What it does                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bootstrap** (`AGENTS.md`, or `CLAUDE.md`) | carries `communication/core.md` and `economy/core.md` between markers, plus a task → skill map. `install-harness` writes both into consumer repos; `instruction-blocks` fails on drift. |
| **Description**                             | `<what it does>. Use when <triggers>. Not for <neighbor> (see <skill>).` The host auto-selects on it.                                                                                   |
| **Manual**                                  | every skill is also a command: `/git` in Claude Code, `$git` in Codex. No skill is manual-only.                                                                                         |

Discovery never authorizes an action: commits, pushes, and publishing still need the task's authorization.

## The set

| Skill                                                 | Use when                                                                                                               | Pairs with    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------- |
| [communication](../skills/communication/SKILL.md)     | always on through `AGENTS.md`; the skill itself loads for READMEs, ADRs/PDRs, PR text                                  | all           |
| [economy](../skills/economy/SKILL.md)                 | always on through `AGENTS.md` (reading, output, scoped checks); the skill loads to delegate, fan out, or run long work | none          |
| [align](../skills/align/SKILL.md)                     | several open decisions, ambiguous domain terms, spec contradicts code                                                  | none          |
| [build](../skills/build/SKILL.md)                     | writing or changing code and tests: least code, tests read as stories                                                  | none          |
| [code-review](../skills/code-review/SKILL.md)         | reviewing a change for what gates miss, and drift from the request                                                     | none          |
| [git](../skills/git/SKILL.md)                         | commits, history, PRs (short descriptions, no model credits)                                                           | communication |
| [retrospect](../skills/retrospect/SKILL.md)           | a correction repeats: route it to type, rule, check, test, script, or skill                                            | none          |
| [install-harness](../skills/install-harness/SKILL.md) | adding Harness packages and skills to a project                                                                        | none          |
| [shopify-review](../skills/shopify-review/SKILL.md)   | Shopify app readiness ([Shopify guide](shopify.md))                                                                    | code-review   |

## Validation covers files, not behavior

```sh
pnpm skills:check   # frontmatter, body ≤ 450 words, no em dashes, local links, invocation metadata
pnpm quality:check  # AGENTS.md communication and economy blocks match their core.md
pnpm test:skills    # those behaviors on isolated fixtures
```

Neither scores the writing or proves routing picks the right skill. Sources behind the skills: [CREDITS](../CREDITS.md).

The always-on communication block carries the evaluated YAML v1 policy directly in `AGENTS.md`. It needs no skill load for ordinary replies. The communication skill adds guidance only for long documents. Its word targets apply to explanations, never code, tests, names, validation, or design.
