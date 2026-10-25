## Economy

Always on, every task. Each call re-reads the whole context; anything in it is paid again on every later call.

- **Search, then read a range.** `rg -n`/Grep first, then the needed lines (offset/limit, `sed -n 'a,bp'`). Never `cat` a file over ~200 lines or several at once; never re-read what context holds.
- **Trim output at the source.** Failing tests only (`--reporter=dot`, fail-only flag), `git diff --stat` before the full diff, `| tail -n 40` on logs. A log needed whole goes to a file; read the failing part.
- **Check the changed scope.** Full gate at most once, final state before the PR, or never when the project leaves it to CI.
- **Stay out of vendored trees.** Targeted `rg` with a path in vendored/generated trees, never a listing/full read.
- **Delegate only broad, independent work.** Under ~5 files or one question: inline. Delegated: brief + budget (load the economy skill). **Wait once, never poll:** block on the command or use the host's wait tool; no `sleep` loops.
