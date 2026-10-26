## Economy

Always on, every task. Each call re-reads the whole context; anything in it is paid again on every later call.

- **Search, then read a range.** `rg -n`/Grep first, then the needed lines (offset/limit, `sed -n 'a,bp'`). Never `cat` a file over ~200 lines or several at once; never re-read what context holds.
- **Trim output at the source.** Failing tests only (`--reporter=dot`, fail-only flag), `git diff --stat` before the full diff. Capture exit status on the first run (`pipefail` with `tail`); never rerun a passing gate to recover it. Whole logs go to a file; read the failing part.
- **Check the changed scope.** Scoped checks while iterating; then one full gate on the final state before handoff (PR or no PR), or CI when delegated by the project. Run checks in that order, not in parallel.
- **Stay out of vendored trees.** Targeted `rg` with a path in vendored/generated trees, never a listing/full read.
- **Delegate only broad, independent work.** Under ~5 files or one question: inline. Delegated: brief + budget (load the economy skill). **Wait once, never poll:** block on the command or use the host's wait tool; no `sleep` loops.
