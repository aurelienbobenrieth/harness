---
"@aurelienbbn/agentlint-plugin-core": minor
---

Add the opt-in `fallback-masks-failure` rule (exported as `fallbackMasksFailure` / `defineFallbackMasksFailure`, not part of `strictPreset`): empty-literal `??`/`||` fallbacks and parameter defaults on required-looking names, fallback-dense functions, and error handlers that return an empty literal.

`boundary-resilience` (standard revision 2, detector version 2) now reports `catch` clauses and `.catch` callbacks around outbound calls that discard the failure without a `REASON:` comment, looks for `signal`/`timeout` markers in the call arguments only (a URL or comment containing the word no longer satisfies it), and reports a chained call once. The parallelism guidance bullet moved out: `bounded-work` owns it.

`test-behavior-coverage` (standard revision 2, detector version 2) no longer treats `toHaveBeenCalledWith` and the other interaction matchers as outcomes: a mock-dense file asserting interactions only is reported with its own message. Error, property and comparison matchers now count as outcomes. Existing acceptances for both changed rules need a fresh review.
