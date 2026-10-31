# Hill climb: remove friction without weakening evidence

Draft, 31 October 2026. These are candidate steering corrections, not demonstrated improvements in production. KeepCart is read-only throughout this work.

## Three narrow changes address observed failure modes

| Change                                      | Existing signal                                                                                                               | What remains unproved                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Build leaves implementation/test order free | R8 synthetic pilot: imposed TDD took about 82% longer for Claude, 160% for Codex, 3% for Muse                                 | One run per cell; the prompt was not the canonical build skill. No general speed or quality effect established |
| Align preserves settled decisions           | R7 fully specified synthetic case: current reopened a settled choice and failed both blind judgments; none and adapted passed | Adapted did not outperform none; genuine new consequential unknowns must still surface                         |
| Testing accepts correct equivalents         | R7 generated suites rejected valid alternatives, including null-prototype records                                             | New wording must retain defect detection as well as accept equivalents                                         |

R8's nine pilot outputs passed the original 13 checks; a later diagnostic found a fixed-deadline defect in one communication-only Claude output. That diagnostic was post hoc. Passing the original checks did not establish equal quality.

Sources are local, unpublished experiment archives: `evals/skills-redesign-r7/report.md` and `evals/agent-workflow-r8/report.md`. They are absent from this PR because the archive includes private traces. SHA-256 of the reports reviewed, respectively:

```text
b3f2a3eae5ffc6633bb1cfc17ac6ce8718e73cd9f919b8c446869a5249fe368d
97262f6e736dbc577760d12fa4733b0223da3dbf412eb0ad5d8d36d4d9cc74a2
```

Maintainers need the local archive to verify those prior results; these hashes are not a public reproduction package. All R7/R8 behavioral evidence cited here is synthetic. The R8 KeepCart-shaped app was not the real KeepCart application.

## A bounded forward screen tests the combined candidate

Protocol fixed before actor execution. Actor budget: at most 30 cumulative minutes, including unsuccessful attempts; stop rather than add waves. Screen: one independent session per model × arm, up to nine cells. Models: GPT via Codex secours, Claude Opus 5.5, Muse Wonder Full, subject to transport readiness. Missing providers remain missing, never substituted silently.

Arms share the same communication and operational instructions:

- **None:** no additional domain skill text.
- **Current:** baseline build, align and testing text from the PR base.
- **Candidate:** the proposed versions of those three skills.

This compares a bundle, not each skill's independent effect. Provider defaults may remain; record exposed context rather than call none instruction-free. No access to Harness, prior experiments, graders or another actor's output. Each actor returns a test module and a short scope decision; it does not implement the subject. This does not measure implementation speed, greenfield architecture, maintenance cost or long-thread drift.

### Actor request

```text
All product decisions below are settled and authorized. Produce tests only, not an implementation.
API: export function indexFlags(entries) from './subject.mjs'.
entries is an array of [string, boolean|number|null|undefined] pairs.
Return a record containing exactly the input keys as own enumerable data properties.
Duplicate keys keep the last value. Preserve values including false, 0, null and undefined.
Every string key is valid, including __proto__, constructor and toString.
Do not mutate entries or its pairs. No required output prototype or key ordering.
Use node:test and node:assert/strict. No packages, network, tools or file access.
First state whether a product decision blocks this request, in at most two sentences.
Then return one complete fenced JavaScript test module importing './subject.mjs'.
```

### Acceptance checks fixed before execution

Run each generated suite unchanged against two correct subjects: a null-prototype record and an ordinary record with safely defined own properties. Both must pass. Run it against four defective subjects: first duplicate wins, false/zero/null/undefined discarded, unsafe ordinary assignment loses `__proto__`, and input array reversed in place.

Validate the checker first with a hand-written contract suite: both correct controls pass, all four defects fail. A crash/import failure is separate from an assertion exposing the intended defect. Unsupported output is an invalid cell, not a product failure. Scope judgment: does the response unnecessarily block on a settled product decision? Do not infer this from question marks alone.

Record prompt and skill hashes, requested/observed model, actor wall time, terminal status, usage fields when supplied (otherwise null), generated test module, each control's exit and failure reason. Keep timeouts, transport errors and manual stops separate. Count full actor cost, not just successful cells; do not treat words as tokens or add incompatible provider fields.

One run per cell can find a counterexample, not establish an effect. No speed, token-saving or winning-model claim follows from this screen. Do not tune again on these same cases and call them held-out.

## All nine suites pass this screen; no advantage is demonstrated

| Model                      | Arm       | Correct subjects accepted | Defective subjects rejected | Blocks on a settled decision | Actor wall seconds |
| -------------------------- | --------- | ------------------------- | --------------------------- | ---------------------------- | ------------------ |
| GPT-6.1 Sol, Codex secours | None      | 2/2                       | 4/4                         | No                           | 34.9               |
| GPT-6.1 Sol, Codex secours | Current   | 2/2                       | 4/4                         | No                           | 39.0               |
| GPT-6.1 Sol, Codex secours | Candidate | 2/2                       | 4/4                         | No                           | 44.2               |
| Claude Opus 5.5            | None      | 2/2                       | 4/4                         | No                           | 36.2               |
| Claude Opus 5.5            | Current   | 2/2                       | 4/4                         | No                           | 44.1               |
| Claude Opus 5.5            | Candidate | 2/2                       | 4/4                         | No                           | 38.8               |
| Muse Wonder Full 1.0       | None      | 2/2                       | 4/4                         | No                           | 69.6               |
| Muse Wonder Full 1.0       | Current   | 2/2                       | 4/4                         | No                           | 40.9               |
| Muse Wonder Full 1.0       | Candidate | 2/2                       | 4/4                         | No                           | 54.1               |

All cells completed; no actor retry, timeout or censored cell. Codex times are durable run start-to-completion; CLI times include process startup. Their sum is about 402 seconds, below the 1,800-second actor budget. Setup, parent work, audits, grading and repository validation are outside that actor-only total. Single runs, different transports, cache states and fixed within-provider order prevent causal speed comparisons.

Claude-current, Muse-current and Muse-candidate detect input mutation through `Array.reverse()` throwing on a frozen input. This is the mutation defect manifesting, not an import/setup failure. The other six also produce assertion failures on mutated input. An independent, non-blind reviewer checked the controls, results and proposed changes; no blocking finding remained. This is not an independent quality score of implemented applications.

| Provider-reported usage                    | None            | Current           | Candidate         |
| ------------------------------------------ | --------------- | ----------------- | ----------------- |
| Claude output tokens                       | 3,848           | 4,630             | 4,064             |
| Claude input / cache creation / cache read | 2 / 2,391 / 649 | 2 / 4,641 / 1,545 | 2 / 4,721 / 1,545 |
| Claude reported list-price USD             | 0.096226        | 0.130045          | 0.119365          |
| Muse output / reasoning tokens             | 2,201 / 618     | 2,010 / 1,011     | 2,409 / 1,253     |
| Muse input / cached tokens                 | 27,845 / 0      | 29,962 / 16,244   | 29,986 / 16,244   |
| Codex usage and cost                       | null            | null              | null              |

These are native fields, not comparable accounting definitions or a full campaign bill. Codex identity is the requested durable run model, not independent backend attestation. Codex retained ambient Harness instructions; Claude exposed no tools/MCP, while Muse exposed its CLI system context. The no-tools request did not remove those contexts. No clean skill-less or cross-provider cost claim follows.

Local forward artifacts are in ignored `.tmp/hill-screen/`: frozen prompts and hashes in `manifest.json`, replies, CLI metadata and control exits/output in `grades.json`. These are not included in the public PR, so the tables are reported observations, not a public replay package. The protocol hash predates document formatting and the historical/results sections. After this screen, two candidate testing sentences were shortened to meet the existing 450-word skill budget, and the failure clause was clarified to exclude unrelated setup errors rather than all type errors. That final wording was not rerun through actors.

Decision: propose the three narrow corrections for review based on the prior counterexamples and unnecessary ordering constraint. This screen finds no regression on its case and no added value over none. Do not treat it as validation of the whole Harness, proof of faster implementation, or a reason to expand the skill bundle.

Repository validation is a separate cost: the first full gate took 552 seconds and failed formatting and the testing skill's word budget. After corrections, another full gate took 569 seconds and passed 16/17 steps, with 11 unit-test timeouts in unchanged Shopify test files. A further full run limits its own process tree to two CPUs, which makes `availableParallelism()` report two and reduces Vitest workers through the existing configuration. That CPU-affinity attempt caused Knip to exceed its 120-second limit and was stopped, with unfinished steps censored. The next full run uses Vitest's existing `VITEST_MAX_WORKERS=2` override without restricting CPU affinity. No timeout, assertion or test selection was relaxed. These observations do not establish the cause of those timeouts or a Harness-wide performance effect.

## Harness value needs a task-level comparison

A bounded historical audit sampled 12 non-subagent threads created in October: ten KeepCart and two Harness, across Claude, Codex and Muse. Two long threads were only partially read. Repeated user corrections concerned verbose explanations, difficult PRs, redundant validation and costly compliance decisions. These establish friction and preferences, not a causal defect rate. Historical assistant diagnoses were not reproduced against the current consumer configuration. Private thread identifiers and business content are intentionally omitted.

| Surface                   | Evidence in this draft                                     | Still needed                                                                                                 |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Generic rule correctness  | Existing package tests and repository gate                 | Findings' precision and avoided defects on representative consumer changes                                   |
| Skill behavior            | Synthetic R7/R8 evidence and the bounded forward screen    | Larger independent tasks and long native conversations                                                       |
| KeepCart integration      | Historical messages only; no app commands or modifications | Current installed versions, enabled checks, actual gate execution and task-level payoff                      |
| Learning from corrections | Recurring friction identified                              | Verify announced → configured → executed → blocking; retain useful signals without duplicate review surfaces |

The absence of a measured benefit does not establish that a rule or skill is useless. Neither a clean gate nor a large rule catalog establishes that Harness pays for itself.

The repository already provides import boundaries, cycle checks, conformance, behavioral tests and affected-package validation. Adding another graph engine or a global council is not justified by the evidence above.

For subsequent evaluation, freeze fresh cases and thresholds before changing steering. Include brownfield changes with late requirement revisions and a greenfield case. Compare communication-only, current Harness and the candidate on the same tasks and models. Two runs per cell are a minimum repeatability check, not a statistical guarantee. Keep reference outputs and reviewers independent of candidate design.

Measure critical defects, valid-equivalent rejection, user interventions, correction cycles, elapsed time through acceptance and complete token/cost fields. Then apply the same follow-up requirement to each accepted output: measure touched public boundaries, regressions and time to change. Blind reviewers inspect actual execution paths and consequences; their scores supplement executable evidence.

An extra critical defect blocks promotion. A candidate with no demonstrated quality gain must justify its added cost. Otherwise trim or retain uncertainty. Faster first output alone is insufficient. No production KeepCart benefit or future-proofing is established by this PR.

## A formal-checking pilot should connect counterexamples to executable code

The user proposed formal verification after the screen. Upstream pstack provides [project-specific formal verification](https://github.com/cursor/plugins/blob/main/pstack/skills/create-formal-verification-skill/SKILL.md) and [maintenance of its correspondence with code](https://github.com/cursor/plugins/blob/main/pstack/skills/maintain-formal-verification-skill/SKILL.md). This draft neither installs nor implements those skills.

Proposed next experiment: choose one costly state invariant, such as preventing duplicate effects during webhook retries. Explore a bounded model of concurrent steps, then replay each violating trace against the actual implementation. Preserve an executable regression and a readable state path. Include a broken control so that the verifier must demonstrate sensitivity. A passing abstract model is not a proof of the deployed implementation.

The useful extension would connect covered code changes to a stale-verification signal and distinguish model drift, a reproducible product defect, an incomplete exploration and a verified property within stated assumptions. A file-change signal can demand rechecking; it cannot prove semantic correspondence automatically. Measure setup, rerun and maintenance cost against extra defects found before adopting this workflow. This is a proposal, with no formal-verification run or benefit measured in this campaign.
