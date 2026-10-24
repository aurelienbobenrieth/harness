## Economy

Always on, for every task. Each model call re-reads the whole context, so anything that enters it is paid again on every later call. Spend tokens on the work, not on reading noise.

- **Search, then read a range.** `rg -n` or Grep first, then read the lines you need (offset and limit, `sed -n 'a,bp'`). Never `cat` a file over ~200 lines or several files at once; never re-read what the context already holds.
- **Trim output at the source.** Failing tests only (`--reporter=dot`, a fail-only flag), `git diff --stat` before the full diff, `| tail -n 40` on logs. A log you need whole goes to a file; read the failing part.
- **Check the changed scope.** Run the checks the change can affect; the full gate runs once, on the final state, before the PR.
- **Stay out of vendored trees.** `node_modules`, lockfiles, reference clones, build output, generated files: a targeted `rg` with a path, never a listing or a full read.
- **Delegate only broad, independent work.** Fewer than ~5 files or a single question: do it inline. A delegated task gets a brief and a budget: load the economy skill.
- **Wait once, never poll.** Block on the command, or use the host's wait tool; no `sleep` loops.
