# Steering skills

**Skills carry the judgment no check can make; anything deterministic belongs to lint, conformance, or tests.** A skill never restates a rule; it points at it. A SKILL.md body stays under 450 words: detail only some tasks need lives in `references/`, read on demand.

## How a skill gets used at the right moment

```text
session start ─▶ AGENTS.md: communication rules + task → skill map ─▶ agent loads the matching skill before acting
                                                                   └▶ fallback: host matches the skill's description
```

| Layer                                       | What it does                                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bootstrap** (`AGENTS.md`, or `CLAUDE.md`) | carries `communication/core.md` between markers, plus a task → skill map. `install-harness` writes both into consumer repos; `instruction-blocks` fails on drift. |
| **Description**                             | `<what it does>. Use when <triggers>. Not for <neighbor> (see <skill>).` The host auto-selects on it.                                                             |
| **Manual**                                  | every skill is also a command: `/build` in Claude Code, `$build` in Codex. No skill is manual-only.                                                               |

Discovery never authorizes an action: commits, pushes, and publishing still need the task's authorization.

## The set

| Skill                                                 | Use when                                                                                                                     | Pairs with     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------- |
| [communication](../skills/communication/SKILL.md)     | always on through `AGENTS.md`; the skill itself loads for READMEs, ADRs/PDRs, PR text                                        | all            |
| [align](../skills/align/SKILL.md)                     | several open decisions, ambiguous domain terms, spec contradicts code                                                        | build          |
| [build](../skills/build/SKILL.md)                     | feature, fix, refactor: verifiable behavior, task-appropriate work order, design rules backed by lint                        | testing, align |
| [testing](../skills/testing/SKILL.md)                 | writing or judging tests; picking strategies by failure ([strategies](../skills/testing/references/strategies.md) on demand) | build          |
| [code-review](../skills/code-review/SKILL.md)         | reviewing a change for what gates miss, and drift from the request                                                           | build, testing |
| [git](../skills/git/SKILL.md)                         | commits, history, PRs (short descriptions, no model credits)                                                                 | communication  |
| [retrospect](../skills/retrospect/SKILL.md)           | a correction repeats: route it to type, rule, check, test, script, or skill                                                  | toolsmith      |
| [toolsmith](../skills/toolsmith/SKILL.md)             | writing a reusable script or tool that must be safe to rerun                                                                 | retrospect     |
| [install-harness](../skills/install-harness/SKILL.md) | adding Harness packages and skills to a project                                                                              | none           |
| [shopify-review](../skills/shopify-review/SKILL.md)   | Shopify app readiness ([Shopify guide](shopify.md))                                                                          | code-review    |

## Validation covers files, not behavior

```sh
pnpm skills:check   # frontmatter, body ≤ 450 words, no em dashes, local links, invocation metadata
pnpm quality:check  # AGENTS.md communication block matches skills/communication/core.md
pnpm test:skills    # those behaviors on isolated fixtures
```

Neither scores the writing or proves routing picks the right skill. Sources behind the skills: [CREDITS](../CREDITS.md).
