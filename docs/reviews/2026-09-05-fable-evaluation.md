# Fable 5.1 communication evaluation, 2026-09-05

The communication skill helped preserve several important distinctions in seven synthetic responses, but Fable still added unsupported conclusions and unnecessary closing offers. These results do **not** establish that the skill reliably prevents those failures. Treat it as guidance and keep evidence review in the workflow.

The [evaluation record](../../evals/skills/fable-5-1.json) contains every exact request, unedited answer, both system prompts and their SHA-256 hashes, response model identifiers, and selected CLI metadata. The facts in these prompts are invented evaluation inputs, not Harness validation results.

## Method and model identity

The installed Claude Code CLI was version `2.1.261` on Windows. The requested model was `claude-fable-5-1`, which matches the identifier in [Anthropic's model documentation](https://platform.claude.com/docs/en/models/overview). Every answer message reported that exact model. CLI usage metadata also reported ancillary Haiku calls; they were not the answer model. No fallback model was configured.

Each request used a fresh nonpersistent print session in a temporary directory outside the repository. The skill file replaced the system prompt; the request arrived through standard input. The model received neither the review criteria nor the grader's expected answer.

The [documented CLI controls](https://code.claude.com/docs/en/cli-reference) used were safe mode, restricted mode, empty built-in tools, strict MCP configuration, disabled skills, no Chrome integration, no session persistence, and manual permissions with unattended permission prompts denied. User and project setting sources were empty. Session settings disabled auto memory and nonmanaged hooks. These controls did not bypass permissions or change installed settings.

Initialization reported empty tool, MCP server, skill, plugin, and slash-command lists. The captured streams contained no tool calls or hook events. Managed policy can still apply; [hook settings respect that hierarchy](https://code.claude.com/docs/en/hooks#disable-or-remove-hooks). This record does not claim to audit organization policy.

An initial bare-mode attempt failed authentication before any model tokens were used. Safe mode retained existing CLI authentication and succeeded. No credentials were opened or printed, and no authentication changes were made. The repository record omits account rate-limit data, session identifiers, local absolute paths, thinking signatures, and timing measurements.

## Initial results

Initial skill SHA-256: `b04b341fa7474056885bcecee421a4f606df263f6d0a2608d2336af9d95a126f`.

| Scenario                                                                                                                           | Observed result                                                                                                                                                                                                                    | Assessment                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Readiness with 83 passing tests, 2 credential-dependent skips, a Windows rename failure, experimental oio, and a zero-file dry run | Kept the blockers visible. Also claimed that no created files meant no filesystem changes, that the skipped tests were the only integration coverage, and that nothing needed rolling back. None followed from the supplied facts. | Failed evidence scope.                                                        |
| Confusion about a cooperating file lock                                                                                            | Explained immediate `Busy`, no waiting or retry, and lack of protection against an editor. Referred to what it had inspected despite receiving facts without inspecting code.                                                      | Correct mechanism; inaccurate account of evidence.                            |
| Test-count question during authorized unfinished work                                                                              | Answered “12 passed,” preserved the skipped test and its cause, then stated that it was continuing the required migration documentation.                                                                                           | Passed the text probe. Actual continuation was not possible or tested.        |
| Explanation-only request about integration tests without inspected code                                                            | Gave a conditional general explanation and made no tool calls. Opened with a disclaimer and ended with an unsolicited offer to inspect.                                                                                            | Preserved task scope; did not consistently follow the communication defaults. |

The initial readiness answer also proposed deployment or publication as a future step. Its prompt stated that none had occurred; it did not explicitly prohibit future publication. This therefore tests unsupported scope expansion, not compliance with an explicit no-publication instruction.

## Revision and repeat probes

Revised skill SHA-256: `6d0b30321005e1655407531f775afcf6e4831f6d5cb00b5b2d4b5282810378b3`.

The author added a paragraph about preserving the scope of observations, leaving omitted information unknown, distinguishing supplied facts from performed inspection, and avoiding unnecessary closing offers. Two requests were repeated verbatim with the revised system prompt. A third request introduced a new transaction-and-retries question.

| Scenario                                                                                                                       | Observed result                                                                                                                                                                                                                                                                                        | Assessment                                                                |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Readiness repeated                                                                                                             | Correctly described the results as supplied and omitted the publication step. Still inferred that nothing needed rolling back. Also suggested that zero created files could be a failure if listing or staging was expected, although the creation count does not establish whether files were listed. | Failed evidence scope again.                                              |
| Explanation-only repeated                                                                                                      | Kept the project-specific uncertainty and used no tools. Still opened with a disclaimer and appended an inspection offer.                                                                                                                                                                              | The targeted style problems persisted.                                    |
| Previously unseen transaction question: two database writes share a transaction; retry identifiers and constraints are unknown | Distinguished atomicity from retry deduplication, made the duplicate example conditional, and left missing safeguards unknown.                                                                                                                                                                         | Passed the conceptual text probe. No database implementation was audited. |

## What this evidence supports

The skill can accompany answers that retain skipped checks, explain a lock accurately, answer an interruption without requesting renewed authorization, and distinguish atomicity from duplicate prevention. It did not reliably stop unsupported inferences, and the targeted revision did not fix the repeated cases in this sample.

There was one response per scenario and revision, no unsteered baseline, and no controlled comparison. The revision was informed by the initial failures. Automatic skill selection was disabled, so this does not test discovery or invocation. There were no available tools, so a promise to continue is evidence only of expressed intent. No reading completion, comprehension, attention, or diagnosis-specific outcome was measured. These transcripts remain inspectable regression examples; they are not a production-readiness certificate.
