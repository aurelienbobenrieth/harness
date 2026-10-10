# @aurelienbbn/worktree-hygiene

**Parallel agents stop sharing dev servers and stop leaving processes behind: stable ports per worktree, and a check that fails while a worktree still runs something.**

> [!WARNING]
> **Draft, not published.** Private until its process-ownership rules have field use on Linux and macOS. Run it from a Harness checkout or a packed archive.

```console
$ worktree-hygiene ports game worker --format env
GAME_PORT=24260
WORKER_PORT=24261

$ worktree-hygiene done
Still running from C:\work\panache\.claude\worktrees\l6 (1)
    39808  node.exe  [command line, orphaned, listening 24260]  node C:\work\panache\.claude\worktrees\l6\node_modules\vite\bin\vite.js
Stop them before handing back, or run `worktree-hygiene done --reap`.
$ echo $?
1
```

No runtime dependency. Node `^22.19.0 || ^24.11.0`; Windows reads processes through PowerShell CIM, Linux through `ps` and `/proc`, macOS through `ps` and `lsof`.

## Commands

| Command                   | Does                                                                        | Exit                                     |
| ------------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| `ports <name...>`         | one stable port per name, in order (`--format json\|env`)                   | 0                                        |
| `ports <name...> --check` | also lists who listens on them                                              | 1 if a process outside the worktree does |
| `ps`                      | processes of the worktree, and the protected ones it will never stop        | 0                                        |
| `reap`                    | stops orphaned worktree processes (their parent is gone) and their children | 1 if one survives                        |
| `reap --all`              | stops every worktree process except the caller's own chain                  | 1 if one survives                        |
| `reap --dry-run`          | prints what would stop                                                      | 0                                        |
| `done`                    | end-of-task check                                                           | 1 while a worktree process still runs    |
| `done --reap`             | stops them first, then checks                                               | 1 if one survives                        |

Every command takes `--root DIR` (default: the git worktree of the current directory), `--protect NAME` (repeatable), and `--json`. Exit 2 is a usage error or a refused scope (a filesystem root, the home directory); exit 3 means the process table could not be read, never a clean result.

## Ports: same path, same ports

`base + range × stride + index`, with `range = fnv1a(worktree path) % ranges` (defaults 20000, 900, 10). Worktrees of one repository that hash to the same range get the next free one, in path order, so siblings never share a port. Unrelated repositories can still collide: start servers on a strict port so a collision fails instead of drifting to a neighbour, and use `--check` to see who holds it.

```ts
import { worktreePorts } from "@aurelienbbn/worktree-hygiene";

const { ports } = worktreePorts({ root: process.cwd(), names: ["game", "worker"] });
// vite.config.ts: server: { port: ports.game, strictPort: true }
```

## What counts as a worktree process, and what never does

A process belongs to the worktree when its working directory, executable, or command line points inside it (native, forward-slash, and Git Bash `/c/...` spellings; `/wt/a` never matches `/wt/ab`), or it descends from one that does. Worktrees nested inside the root (`git worktree list`) keep their own processes.

Never stopped, whatever the evidence:

- the caller, its ancestors, and its own helper processes;
- the infrastructure of the caller's agent: a direct child of a protected process in the caller's chain (an MCP server) and everything below it, unless that child is a shell, which is how agents run task commands;
- anything below a protected process outside the caller's chain: editors, terminal hosts, file managers, and other agents (`code`, `cursor`, `windowsterminal`, `tmux`, `claude`, `codex`, … `--protect` adds names); `ps` lists these as protected.

Before each signal the target is re-read: same PID, start time, and command line, or it is left alone. `SIGTERM` first, `SIGKILL` after a 3 s grace (Windows terminates on the first signal).

**Limits.** Windows exposes no working directory, so a process started with only relative paths is found through its ancestry, not by itself. An orphan adopted by a session subreaper on Linux is not seen as orphaned: use `reap --all` or `done --reap`. An agent host whose executable name is not protected (for example a plain `node cli.js`) does not get its MCP servers shielded on Linux and macOS, where they inherit the worktree as working directory: add `--protect` for it.

## For agents

Put this in the consumer's `AGENTS.md`:

```text
Dev servers and watchers take their ports from `worktree-hygiene ports <names>`, with a strict port.
Before handing back: `worktree-hygiene done` exits 0, or `done --reap` stops what you started.
```
