---
"@aurelienbbn/worktree-hygiene": minor
---

New private draft: the `worktree-hygiene` CLI gives each worktree stable dev-server ports (`ports`), lists the processes started from it (`ps`), stops its orphans (`reap`), and fails an end-of-task check while any of them still runs (`done`). It never stops the caller's own chain, its agent's infrastructure, or anything below an editor, terminal, or other agent, and revalidates each PID before signalling.
