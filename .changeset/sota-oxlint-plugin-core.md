---
"@aurelienbbn/oxlint-plugin-core": minor
---

Add three rules and tighten two. New: `no-discarded-caught-error` (a `catch` clause or inline promise rejection handler that never rethrows and ignores or only logs the error needs a `REASON:` comment; options `logOnlyCallees`, `reasonMarker`, `includeTestFiles`), `no-error-message-matching` (no comparison, substring/regex matching, or `switch` on the message text of an error-shaped value), and `no-test-sleeps` (no `setTimeout`-backed promises, `node:timers/promises` sleeps, or awaited fixed-duration sleep helpers in test files). `no-weak-test-assertions` now treats literal-versus-literal expects, self-comparisons such as `expect(x).toEqual(x)`, and assertions on a local `vi.fn()` binding's own result as weak. `no-dead-comments` gains a `changeNarration` diagnostic for comments that narrate a diff ("Updated to…", "NEW:", "Previously this…", "Changed from…", "Added … as requested").

Migration: tests that relied on `expect(true).toBe(true)`-style placeholders and handlers that silently default on failure now report; assert an observable outcome, rethrow or branch on the error, or record the reason in a `REASON:` comment. None of these diagnostics has an autofix.
