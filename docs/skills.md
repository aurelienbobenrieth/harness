# Steering skills

**Skills guide the decisions no compiler or check can make: useful evidence, preserved authorization, concise communication.** Files that validate don't make a skill enterprise-ready.

```text
 deterministic?  ── yes ─▶ executable owner   lint (source forms) · conformance (manifests, output) · tests (behavior)
                 └─ no ──▶ skill              selection · uncertainty · evidence boundaries
```

**Duplicate prose is not enforcement.** Checks complement a skill; a skill never restates them.

## Being discovered does not authorize the action

| Mode                                 | Useful when                                                   | Cost                                                           |
| ------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------- |
| **Always loaded** by repo bootstrap  | a small communication preference fits every interaction       | every line costs attention and may conflict; keep it short     |
| **Auto-selected** by description     | the request clearly needs implementation, tests, git, tooling | broad descriptions load needless process; state boundaries     |
| **Explicitly invoked** by the user   | deliberate audit, retrospective, deep test strategy           | commands for ordinary work add friction, leave guidance unused |
| **Deterministic command / CI check** | inputs and outcome are precisely specifiable                  | proves only its inspected contract, not judgment               |

**`communication` is the one always-loaded skill:** a single line in `AGENTS.md` (or the host equivalent) points every session at it. The rest auto-discover once installed in a host's skill location and stay explicitly invocable; `skills/` is source, not auto-loaded. None sets `allow_implicit_invocation: false`: **configure explicit-only only when the user asks.** Sensitive side effects follow the task's authorization in every mode.

## Pick the smallest workflow

| Skill                                                           | Applies to                                                          | Never automatically requires                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| [communication](../skills/communication/SKILL.md)               | every reply and doc, sized to the question (always loaded)          | headings, tables, or visuals the answer doesn't need |
| [build](../skills/build/SKILL.md)                               | authorized implementation + evidence                                | a spec, another approval, tests for a trivial edit   |
| [testing](../skills/testing/SKILL.md)                           | test contracts and assertions                                       | a suite rewrite or new dependency                    |
| [test-strategy](../skills/test-strategy/SKILL.md)               | uncertain invariants, state sequences, boundaries, weak suites      | property/mutation testing for routine examples       |
| [git](../skills/git/SKILL.md)                                   | requested staging, commits, conflicts, PRs                          | a commit, push, or publish per change                |
| [toolsmith](../skills/toolsmith/SKILL.md)                       | recurring manual work, fragile verification                         | a framework for a one-off command                    |
| [code-review](../skills/code-review/SKILL.md)                   | requested independent assessment                                    | fixing code in an assessment-only task               |
| [retrospect](../skills/retrospect/SKILL.md)                     | requested learning, recurring friction                              | a retrospective after every task                     |
| [install-harness](../skills/install-harness/SKILL.md)           | requested consumer integration                                      | drafts or every domain                               |
| [closed-design-system](../skills/closed-design-system/SKILL.md) | deliberately closing a Tailwind theme                               | changing an unrelated design system                  |
| [shopify-review](../skills/shopify-review/SKILL.md)             | requested Shopify quality, requirements, Polaris, copy, integration | a platform audit for an isolated edit                |

`shopify-review` picks surface-specific tooling; checks, triggers, probes, and remaining review work: [Shopify guide](shopify.md).

## Two commands validate the files, not the writing

```sh
pnpm skills:check   # frontmatter, nonempty instructions, local Markdown links, invocation metadata
pnpm test:skills    # exercises those behaviors on isolated fixtures
```

Fails on an empty inventory, missing links, duplicate YAML fields, invalid metadata. **Neither scores writing quality nor proves routing picks the right skill.**

<details>
<summary>Independent inspiration and credits</summary>

Instructions use this repository's own wording and design. **No third-party workflow text or templates were imported.** Greppable JSDoc `@attribution` tags identify deliberately adopted external concepts.

| Source                                                                                                                                                       | Revision · license                                                                                      | Adopted concept                                                  | Deliberately not adopted                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Matt Pocock's [diagnosing-bugs skill](https://github.com/mattpocock/skills/tree/3cca18b368ae95cdbdebbff572ccafa662551015/skills/engineering/diagnosing-bugs) | `3cca18b368ae95cdbdebbff572ccafa662551015` · MIT                                                        | diagnosis tied to the observed symptom                           | a mandatory hypothesis count; a universal stop-before-reproduction rule         |
| Dillon Mulroy's [bro skill](https://github.com/dmmulroy/skills/tree/8603380821fee6a77c82639f364ce8fe4f5a92be/bro)                                            | `8603380821fee6a77c82639f364ce8fe4f5a92be` · MIT (the inspected repository license credits Matt Pocock) | a focused request to clarify an explanation                      | another required command: explanation recovery lives in communication instead   |
| Matt Pocock's [wait-what skill](https://github.com/mattpocock/skills/tree/3cca18b368ae95cdbdebbff572ccafa662551015/skills/productivity/wait-what)            | same Matt Pocock revision above · MIT                                                                   | recover missing context; use the reader's established vocabulary | a particular language-standard document; imposing that vocabulary on a newcomer |

Human-led specification and diagnostic workflows help when discovery itself is requested. Making them mandatory for every implementation would undermine the user's authorized autonomy.

Old vague Thermos/code-slop credits were retired with the replaced review material; unverified source-specific claims were not carried into the rewrite.

</details>
