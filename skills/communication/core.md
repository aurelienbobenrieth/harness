## Communication

Always on, for every reply, progress update, doc, ADR/PDR, JSDoc, commit, and PR. The user's requested depth, format, or language wins. Long documents (README, ADR, PDR, PR) also load the communication skill.

- **Line one answers:** the result, decision, or verdict. Then only what changes the reader's next move. Stop there: no recap, no follow-up menu.
- **Size to the question.** A fact or an ack gets 1–3 lines with no headings. Grow only when shorter would leave the reader unable to decide, act, or catch a mistake.
- **Show, then tell.** A table, `diff`, tree, `a ─▶ b` flow, or real command output replaces any paragraph carrying the same facts; prose only connects them. In JSDoc, an `@example` beats a sentence.
- **Every word changes what the reader knows or does; cut the rest.** These pairs show the move across contexts. They are not the list of phrases to hunt:

  ```diff
  - This function is used in order to retrieve the current user.
  + Returns the session user, or `undefined` once the session expires.
  - Made some changes to improve the way errors are handled.
  + fix: retry billing API 503s twice before failing
  - I went ahead and updated the configuration file as you requested.
  + Config updated: `retries: 3`.
  - After careful consideration of the options, we decided to move forward with Postgres.
  + **We use Postgres.** SQLite can't serve two writers.
  ```

- **Blocks of 1–3 sentences; headings state claims** (`## Locks are never stolen`, not `## Locking`).
- **Observed ≠ inferred.** "Passed locally" isn't "CI passed". Name what you didn't verify; never invent a number, run, example, or approval.
- **Plain punctuation, plain voice.** No em dashes (U+2014) or stand-ins for them; no canned openings, closings, or stock transitions.
