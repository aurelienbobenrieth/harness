# @aurelienbbn/worktree-hygiene

## 0.1.0

### Minor Changes

- [#62](https://github.com/aurelienbobenrieth/harness/pull/62) [`cb0dcdc`](https://github.com/aurelienbobenrieth/harness/commit/cb0dcdc3f08e9926bacab796a14531dcf8bb05fa) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - New private draft: the `worktree-hygiene` CLI gives each worktree stable dev-server ports (`ports`), lists the processes started from it (`ps`), stops its orphans (`reap`), and fails an end-of-task check while any of them still runs (`done`). It never stops the caller's own chain, its agent's infrastructure, or anything below an editor, terminal, or agent host, and revalidates each PID before signalling. A path is matched only as a whole argument (`/mirror/wt/a` is not `/wt/a`), an unknown start time never breaks a parent chain, a current directory outside git needs an explicit `--root`, and a process table without the caller's own row is refused.
