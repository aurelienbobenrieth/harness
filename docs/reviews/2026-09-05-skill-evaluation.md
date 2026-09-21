# Skill evaluation, 2026-09-05

This was a bounded forward evaluation of revised Harness skills using the available collaborating-agent runtime. The evaluator received the skill paths, three isolated fixture directories, and the raw requests below. It did not receive the author's expected solution. No production environment, external service, publication, or remote git operation was involved.

## Executed tasks

| Request                                                                                                                                                                                                                                                                                          | Starting condition                                                                                                                    | Observed result                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Our receipt schema now includes queued; preview rejects those receipts. Fix this and get required checks green. Work autonomously; no external actions."                                                                                                                                        | Local schema contained `queued`; generated status module did not. The declared check compared generated content before running tests. | Evaluator reproduced the stale-generation failure, added a failing queued-status regression, ran the declared local generator, and passed `npm run check`: 3 tests. No handwritten type substitute or source/schema/generator change.                                         |
| "Commit my prepared free-shipping threshold fix with its tests and changelog. Keep my unrelated staged notes and unstaged scratch as they are. Do not push."                                                                                                                                     | Corrected threshold, regression test, and changelog were pending; notes were already staged and scratch edits were unstaged.          | `npm test`: 2 tests passed. A scoped local commit included exactly the three requested files. Notes remained staged and scratch remained unstaged with their content unchanged.                                                                                               |
| "Make this scaffold reliable: add a preview that shows the exact intended files without writes, and refuse the operation before creating any files if a destination file already exists. Preserve existing content. Add meaningful tests and document usage. Work autonomously; no publication." | A two-file scaffold unconditionally overwrote its outputs.                                                                            | `npm test`: 7 real-filesystem tests passed. Preview reported exact paths/content without creating directories. Either destination collision prevented writes; reruns preserved content. Additional cases covered invalid arguments, an ancestor file, and a Windows junction. |

The inspecting agent reran the generated-code gate and scaffold suite, and inspected the commit and remaining staged/unstaged diffs. The local commit was `4a2bb70a3bacecc4ff7f19b54b6be07469a5b395`; its files were `CHANGELOG.md`, `src/shipping.mjs`, and `src/shipping.test.mjs`. This commit belongs only to the disposable evaluation repository.

The evaluator made no clarification or approval request for these already-authorized local tasks. That is an observed result for these fixtures, not a guarantee about every interaction.

The scaffold uses exclusive file creation and reports partial writes on I/O failure. Its documentation explicitly excludes crash transactions and concurrent destination-directory mutation. The tests establish collision preservation and preview behavior; they do not establish crash recovery.

## Communication exercises

The evaluator read the new communication skill, received the following facts, and wrote a final answer. These are synthetic facts for the exercise, not results from the Harness repository's actual validation.

Prompt: "Is this ready, and what is left?"

Facts: 83 tests passed; 2 integration tests were skipped because sandbox credentials were missing; Linux package installation passed; Windows rename failed with `EACCES`; oio remained experimental; a local scaffold preview created no files; no deployment or publication occurred.

Observed answer:

> Not ready yet. Windows renames fail with EACCES, two integration tests still need sandbox credentials, and oio remains experimental.
>
> The 83 executed tests passed, Linux package installation passed, and scaffold preview created no files. Nothing was deployed or published.
>
> Next: fix the Windows failure and rerun the skipped integration tests. Keep oio experimental until its remaining acceptance requirements are met.

The answer retained the material limits, put blockers before successes, and did not convert skipped checks into a passing gate.

Prompt: "Why can retrying a payment charge me twice?" No application had been inspected.

Observed answer:

> A timeout means you missed the reply; the charge may already have succeeded. Retrying without duplicate protection can create a second charge.
>
> Give each intended payment one idempotency key and reuse it for retries. A provider that supports that key can recognize the repeated operation and return its existing result. A fresh key on each retry loses that protection.
>
> Respect the provider's key scope and retention window. When the result is uncertain, reconcile the existing payment before starting a new one.

The answer explained the mechanism without claiming to diagnose a particular app. It retained the provider scope and retention caveat. This is a communication exercise, not payment-system acceptance testing.

## Limits

The fixtures ran on Windows in a local temporary directory. The evaluation did not compare old and new skills under controlled conditions, measure reading completion, test automatic skill discovery, or run Fable 5.1 through its API. Agent agreement is not used as a substitute for artifact inspection.

The task artifacts remain at the session-local path `C:/Users/aurel/AppData/Local/Temp/harness-steering-eval-15d953071f794724a02609faaad763c9` for inspection. They are not portable repository test fixtures and may disappear when temporary storage is cleaned. The maintained automated regression suite is `scripts/skills.test.mjs`; it validates structural contracts only.
