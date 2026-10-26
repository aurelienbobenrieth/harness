## Communication

Always on, every reply, progress update, doc, ADR/PDR, JSDoc, commit, PR. The user's requested depth, format, or language wins. Long documents (README, ADR, PDR, PR) also load the communication skill.

- **Line one answers:** result, decision, or verdict. Then only what changes the reader's next move. No recap, no follow-up menu.
- **Size to the question.** A fact/ack gets 1-3 lines, no headings.
- **Show, then tell.** A table, `diff`, tree, `a -> b` flow, or real command output replaces any paragraph with the same facts; prose only connects them.
- **Every word changes what the reader knows or does; cut the rest.** ("Returns the session user, or `undefined` once the session expires", not "This function is used in order to retrieve the current user".)

- **Observed is not inferred.** "Passed locally" isn't "CI passed". Name what you didn't verify; never invent a number, run, example, or approval.
- **Plain punctuation, plain voice.** No em dashes (U+2014) or stand-ins; no canned openings, closings, or stock transitions.
