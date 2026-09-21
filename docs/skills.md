# Steering skills

Harness skills guide decisions that a compiler or deterministic check cannot make. The current set favors useful evidence, preserved authorization, and concise communication. They do not promise enterprise readiness merely because their files validate.

## Invocation

Discovery and execution are different decisions. A discoverable skill can be selected automatically when the request fits; that does not authorize every action described by the skill.

| Mode                                  | Useful when                                                                                     | Cost or limitation                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Always loaded by repository bootstrap | A small communication preference applies to every interaction.                                  | Every instruction consumes attention and may conflict with a particular task. Keep bootstrap short. |
| Automatically selected by description | The request clearly calls for implementation, tests, git operations, or reusable tooling.       | Broad descriptions can load unnecessary process; include meaningful boundaries.                     |
| Explicitly invoked by the user        | The user wants a deliberate audit, retrospective, deep test strategy, or a particular workflow. | Requiring a command for ordinary work adds friction and can leave useful guidance unused.           |
| Deterministic command or CI check     | Inputs and the acceptable outcome can be specified precisely.                                   | A passing command establishes only its inspected contract. It does not replace judgment.            |

All current Harness skills permit normal automatic discovery when installed in a host's supported skill location. The repository's `skills/` tree is source; it is not automatically loaded by every agent. None silently sets `allow_implicit_invocation: false`. Explicit invocation remains available through the host's skill interface after installation. Configure explicit-only invocation only when the user requests it; sensitive side effects still follow the task's authorization regardless of discovery mode.

## Pick the smallest workflow

| Skill                                                           | Applies to                                                        | Does not automatically require                                          |
| --------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [communication](../skills/communication/SKILL.md)               | Answers, meaningful progress updates, reviews, handoffs           | A fixed line count, dramatic opening, or hidden caveats                 |
| [build](../skills/build/SKILL.md)                               | Authorized implementation and its evidence                        | A specification document, another approval, or tests for a trivial edit |
| [testing](../skills/testing/SKILL.md)                           | Meaningful test contracts and assertions                          | A suite rewrite or new dependency                                       |
| [test-strategy](../skills/test-strategy/SKILL.md)               | Uncertain invariants, state sequences, boundaries, or weak suites | Property or mutation testing for routine examples                       |
| [git](../skills/git/SKILL.md)                                   | Requested staging, commits, conflicts, and PR work                | A commit, push, or publication for every code change                    |
| [toolsmith](../skills/toolsmith/SKILL.md)                       | Recurring manual work or fragile verification                     | A new framework for a one-off command                                   |
| [code-review](../skills/code-review/SKILL.md)                   | Requested review and independent assessment                       | Fixing code during an assessment-only task                              |
| [retrospect](../skills/retrospect/SKILL.md)                     | Requested learning or demonstrated recurring friction             | A retrospective after every task                                        |
| [install-harness](../skills/install-harness/SKILL.md)           | Requested consumer integration                                    | Installing draft packages or every available domain                     |
| [closed-design-system](../skills/closed-design-system/SKILL.md) | Deliberately closing a Tailwind theme                             | Changing an unrelated design system                                     |

Deterministic requirements belong in executable owners: syntax-aware lint for source forms, conformance for manifests and output, and tests for behavior. Skills explain selection, uncertainty, and evidence boundaries. Related checks can be complementary; duplicate prose is not a substitute for enforcement.

The [Shopify review skill](../skills/shopify-review/SKILL.md) applies when Shopify quality, requirements, Polaris, copy, or integration review is requested. It selects surface-specific tooling and evidence without requiring a full platform audit for an isolated edit. See the [Shopify tooling guide](shopify.md) for automatic checks, contextual triggers, explicit probes, and remaining review work.

## KeepCart findings

The review read KeepCart's communication, build, testing, git, and toolsmith skills and applicable instructions without changing KeepCart. Useful recurring needs were generated-state repair, fast focused feedback, real boundary verification, careful handling of staged work, and reproducible tools.

The revised Harness versions remove approval loops that ignored existing authorization, mandatory specification ceremony, a blanket network ban that contradicted integration testing, whole-record-only assertions, and a rule that split fixes from their tests. Communication preserves an early answer and attached evidence while removing unverifiable 99% readership claims and fixed budgets that could hide important limits.

KeepCart's installed copies and bootstrap remain unchanged. Adopting these improvements there is a separate integration task; existing consumer instructions can still override or conflict with the revised package.

## Astra and Fable 5.1

Official guidance was checked on 2026-09-05. OpenAI describes Astra as sensitive to conflicting skill instructions and recommends explicit guidance on autonomy, writing style, delegation, and proportional testing. Harness therefore keeps authorization continuous, descriptions narrow, and completion claims tied to executed checks. This is a design response to provider guidance, not a measured performance claim. [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model).

Anthropic's Fable 5.1 guidance identifies dense prose, missing progress updates, unnecessary permission pauses, excess scope, and avoidable waiting on subagents as areas to assess. The shared skills address those decisions without embedding provider API settings. A host must also render the provider's progress events correctly; prose instructions cannot repair a hidden event stream. Use current provider documentation when changing that integration. [Fable 5.1 prompting guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1).

Evaluate realistic tasks under each target model and host before claiming a cross-model improvement. Record the exact model/runtime, skill revision, task, artifacts, unnecessary pauses, scope errors, and verification results. The initial local-task evaluation used the collaborating-agent runtime. Later probes exercised Astra and the actual Fable 5.1 model through isolated Claude Code sessions; their different prompts and hosts do not constitute a controlled model comparison.

## Evidence and limits

`pnpm skills:check` validates discovery frontmatter, nonempty instructions, supported local Markdown references, and optional invocation metadata. It fails on an empty skill inventory, missing links, duplicate YAML fields, and invalid metadata. `pnpm test:skills` exercises those behaviors with isolated fixtures. Neither command scores writing quality or proves that automatic routing selects the right skill.

The [2026-09-05 forward evaluation](reviews/2026-09-05-skill-evaluation.md) records three executed local tasks and two communication exercises. An independent worker received raw requests and fixtures; the skill author inspected the resulting artifacts. This supplies bounded behavioral evidence, not proof of production safety, universal task coverage, or a reader's attention.

The [Astra response record](../evals/skills/astra.json) preserves an unsupported inference about lock contention and two successful follow-up explanations after a targeted revision. The [Fable evaluation](reviews/2026-09-05-fable-evaluation.md) includes seven verified Fable 5.1 responses. It retained blockers and some important distinctions, but readiness summaries still over-inferred from supplied facts after revision. Guidance helps; the results do not justify treating it as an enforced correctness boundary. Exact inputs and responses remain available for future regression probes.

## Independent inspiration and credits

The new instructions use this repository's own wording and design. Greppable JSDoc `@attribution` tags identify deliberately adopted external concepts:

- Matt Pocock's [diagnosing-bugs skill](https://github.com/mattpocock/skills/tree/3cca18b368ae95cdbdebbff572ccafa662551015/skills/engineering/diagnosing-bugs), commit `3cca18b368ae95cdbdebbff572ccafa662551015`, MIT: diagnosis tied to the observed symptom. Harness does not adopt a mandatory hypothesis count or a universal stop-before-reproduction rule.
- Dillon Mulroy's [bro skill](https://github.com/dmmulroy/skills/tree/8603380821fee6a77c82639f364ce8fe4f5a92be/bro), commit `8603380821fee6a77c82639f364ce8fe4f5a92be`, MIT: a focused request to clarify an explanation. The inspected repository license credits Matt Pocock. Harness incorporates explanation recovery into communication rather than adding another required command.
- Matt Pocock's [wait-what skill](https://github.com/mattpocock/skills/tree/3cca18b368ae95cdbdebbff572ccafa662551015/skills/productivity/wait-what), at the same Matt Pocock revision above, MIT: recover missing context and use the reader's established vocabulary. Harness does not require a particular language-standard document or impose that vocabulary on a newcomer.

Human-led specification and diagnostic workflows can be useful when discovery itself is requested. Making them mandatory for every implementation would undermine the user's authorized autonomy. No third-party workflow text or templates were imported. Old vague Thermos/code-slop credits were retired with the replaced review material; unverified source-specific claims were not carried into the rewrite.
