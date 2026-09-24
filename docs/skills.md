# Steering skills

**Skills carry the judgment no check can make; anything deterministic belongs to lint, conformance, or tests.** A skill never restates a rule; it points at it.

## How a skill gets used at the right moment

```text
session start ─▶ AGENTS.md: read communication + task → skill map ─▶ agent loads the matching skill before acting
                                                                   └▶ fallback: host matches the skill's description
```

| Layer                                       | What it does                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Bootstrap** (`AGENTS.md`, or `CLAUDE.md`) | always loads `communication`, plus a 9-line task → skill map. `install-harness` writes the same block into consumer repos. |
| **Description**                             | `<what it does>. Use when <triggers>. Not for <neighbor> (see <skill>).` The host auto-selects on it.                      |
| **Manual**                                  | every skill is also a command: `/build` in Claude Code, `$build` in Codex. No skill is manual-only.                        |

Discovery never authorizes an action: commits, pushes, and publishing still need the task's authorization.

## The set

| Skill                                                 | Use when                                                                                                                     | Pairs with     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------- |
| [communication](../skills/communication/SKILL.md)     | always: every reply and doc, JSDoc included; never code structure                                                            | all            |
| [align](../skills/align/SKILL.md)                     | several open decisions, ambiguous domain terms, spec contradicts code                                                        | build          |
| [build](../skills/build/SKILL.md)                     | feature, fix, refactor: test-first loop, design rules backed by lint                                                         | testing, align |
| [testing](../skills/testing/SKILL.md)                 | writing or judging tests; picking strategies by failure ([strategies](../skills/testing/references/strategies.md) on demand) | build          |
| [code-review](../skills/code-review/SKILL.md)         | reviewing a change for what gates miss, and drift from the request                                                           | build, testing |
| [git](../skills/git/SKILL.md)                         | commits, history, PRs (short descriptions, no model credits)                                                                 | communication  |
| [retrospect](../skills/retrospect/SKILL.md)           | a correction repeats: route it to type, rule, check, test, script, or skill                                                  | toolsmith      |
| [toolsmith](../skills/toolsmith/SKILL.md)             | writing a reusable script or tool that must be safe to rerun                                                                 | retrospect     |
| [install-harness](../skills/install-harness/SKILL.md) | adding Harness packages and skills to a project                                                                              | —              |
| [shopify-review](../skills/shopify-review/SKILL.md)   | Shopify app readiness ([Shopify guide](shopify.md))                                                                          | code-review    |

## Validation covers files, not behavior

```sh
pnpm skills:check   # frontmatter, nonempty body, local links, invocation metadata
pnpm test:skills    # those behaviors on isolated fixtures
```

Neither scores the writing or proves routing picks the right skill. Sources behind the skills: [CREDITS](../CREDITS.md).
