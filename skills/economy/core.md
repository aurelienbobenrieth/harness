## Economy

Always on, every task: everything in context is paid again on every call.

- **Search first, then read only the needed range.** Never re-read what context holds.
- **Trim output at the source.**
  - Failing tests only (`--reporter=dot`, fail-only flag).
  - `git diff --stat` before the full diff.
  - Capture exit status on the first run (`pipefail` with `tail`); never rerun a passing gate to recover it.
  - Whole logs go to a file; read the failing part.
- **Check the changed scope.**
  - Scoped checks while iterating.
  - Then one full gate on the final state before handoff (PR or no PR), or CI when delegated by the project.
  - In that order, not in parallel.
- **Stay out of vendored trees.** Targeted `rg` with a path in vendored/generated trees, never a listing/full read.
- **Delegate only broad, independent work.**
  - Under ~5 files or one question: inline.
  - Delegated: brief + budget (load the economy skill).
  - Wait once, never poll; no `sleep` loops.
- **Read around the named source.**
  - Asked to write from a file: list its folder and read its neighbours first.
  - A fact there that changes the answer goes in the output, with its source.
