/**
 * Which processes belong to a worktree, decided from a process table snapshot: pure, so every safety rule is a
 * unit test over plain values.
 *
 * @module
 */

/** One row of a process table snapshot. */
export type ProcessInfo = {
  readonly pid: number;
  readonly ppid: number;
  /** Executable base name, e.g. `node.exe` or `node`. */
  readonly name: string;
  readonly commandLine: string;
  /** Absolute executable path, when the platform exposes it. */
  readonly executable?: string | undefined;
  /** Working directory, when the platform exposes it (never on Windows). */
  readonly cwd?: string | undefined;
  /** Start time in epoch milliseconds; with `pid`, the identity a kill revalidates against PID reuse. */
  readonly started: number;
};

/** The worktree a selection is scoped to. */
export type WorktreeScope = {
  /** Absolute path of the worktree root. */
  readonly root: string;
  /** Worktrees nested inside `root` (e.g. `.claude/worktrees/*`): their processes are theirs, not root's. */
  readonly nested?: readonly string[];
  readonly platform?: NodeJS.Platform;
};

/** Why a process belongs to the worktree. */
export type Evidence = "cwd" | "executable" | "command line" | "descendant";

export type OwnedProcess = {
  readonly process: ProcessInfo;
  readonly evidence: Evidence;
  /** Its parent is gone, was replaced by a newer process with the same PID, or is the init process. */
  readonly orphaned: boolean;
  /** PID of the protected process (editor, other agent) it descends from; such a process is never stopped. */
  readonly protectedBy?: number;
};

export type Selection = {
  /** Owned processes that may be stopped, parents before children. */
  readonly owned: readonly OwnedProcess[];
  /** Owned processes left alone because they descend from a protected process outside the caller's own chain. */
  readonly protected: readonly OwnedProcess[];
};

export type SelectionRequest = WorktreeScope & {
  readonly table: readonly ProcessInfo[];
  /** The calling process: it and its ancestors are never selected. */
  readonly self: number;
  /** Executable base names whose descendants are protected, compared without `.exe` and case. */
  readonly protectedNames?: readonly string[];
};

/**
 * Editors, terminal hosts, file managers, and agent hosts: what they run in the worktree (language servers, a
 * person's shell, another agent's session) is not a leftover of the caller.
 */
export const defaultProtectedNames: readonly string[] = [
  "explorer",
  "finder",
  "windowsterminal",
  "wezterm-gui",
  "alacritty",
  "kitty",
  "iterm2",
  "terminal",
  "gnome-terminal-server",
  "konsole",
  "tmux",
  "code",
  "code-insiders",
  "cursor",
  "windsurf",
  "zed",
  "idea",
  "idea64",
  "webstorm",
  "webstorm64",
  "sublime_text",
  "nvim",
  "vim",
  "emacs",
  "claude",
  "codex",
];

const initNames = new Set(["init", "systemd", "launchd"]);
const shellNames = new Set(["sh", "bash", "zsh", "fish", "dash", "ksh", "cmd", "powershell", "pwsh", "nu"]);

function baseName(name: string): string {
  return (name.split(/[\\/]/u).at(-1) ?? name).toLowerCase().replace(/\.exe$/u, "");
}

function comparable(text: string, platform: NodeJS.Platform): string {
  return platform === "win32" ? text.replaceAll("\\", "/").toLowerCase() : text;
}

/** Spellings of a path a command line may carry: native, forward-slashed, and Git Bash `/c/...` on Windows. */
function spellings(root: string, platform: NodeJS.Platform): readonly string[] {
  const key = comparable(root, platform).replace(/\/+$/u, "");
  const drive = /^(?<letter>[a-z]):\//u.exec(key)?.groups?.["letter"];
  return platform === "win32" && drive !== undefined ? [key, `/${drive}/${key.slice(3)}`] : [key];
}

const boundary = /^(?:$|[/\s"'`;:,)\]=])/u;

/** True when `text`, at `index`, continues with one of `roots` up to a path boundary. */
function startsWithRoot(text: string, index: number, roots: readonly string[]): boolean {
  return roots.some((root) => text.startsWith(root, index) && boundary.test(text.slice(index + root.length)));
}

/** True when `text` mentions a path inside `root` that is not inside one of the nested worktrees. */
export function mentionsWorktree(text: string, scope: WorktreeScope): boolean {
  const platform = scope.platform ?? process.platform;
  const haystack = comparable(text, platform);
  const roots = spellings(scope.root, platform);
  const nested = (scope.nested ?? []).flatMap((worktree) => spellings(worktree, platform));

  return roots.some((root) => {
    const occurrences = [...haystack.matchAll(new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu"))];
    return occurrences.some(
      (match) => startsWithRoot(haystack, match.index, [root]) && !startsWithRoot(haystack, match.index, nested),
    );
  });
}

function directEvidence(process: ProcessInfo, scope: WorktreeScope): Evidence | undefined {
  if (process.cwd !== undefined && mentionsWorktree(process.cwd, scope)) return "cwd";
  if (process.executable !== undefined && mentionsWorktree(process.executable, scope)) return "executable";
  if (mentionsWorktree(process.commandLine, scope)) return "command line";
  return undefined;
}

/** The parent of `process`, or `undefined` when the PID is gone or now names a process started later. */
function parentOf(byPid: ReadonlyMap<number, ProcessInfo>, process: ProcessInfo): ProcessInfo | undefined {
  const parent = byPid.get(process.ppid);
  return parent !== undefined && parent.pid !== process.pid && parent.started <= process.started ? parent : undefined;
}

function ancestorsOf(byPid: ReadonlyMap<number, ProcessInfo>, process: ProcessInfo): readonly ProcessInfo[] {
  const chain: ProcessInfo[] = [];
  const seen = new Set<number>([process.pid]);
  for (let parent = parentOf(byPid, process); parent !== undefined && !seen.has(parent.pid);) {
    chain.push(parent);
    seen.add(parent.pid);
    parent = parentOf(byPid, parent);
  }
  return chain;
}

/** How one process relates to the caller, read off its ancestry. */
type Standing =
  | { readonly kind: "own" }
  | { readonly kind: "candidate"; readonly evidence: Evidence | undefined; readonly protectedBy: number | undefined };

/**
 * Processes of a worktree: those whose working directory, executable, or command line points inside it, plus their
 * descendants. Never selected:
 *
 * - the caller, its ancestors, and its own descendants (the tool's helper processes);
 * - an agent host's infrastructure: a direct child of a protected process in the caller's chain (an MCP server of the
 *   caller's own agent) and everything below it, unless that child is a shell, which is how agents run task commands;
 * - membership never flows down through the caller's chain: an agent host whose command line names the worktree does
 *   not make all of its children members.
 *
 * A member whose ancestry reaches a protected name (an editor, another agent) before the caller's chain is reported
 * as protected, never as stoppable.
 */
export function selectWorktreeProcesses(request: SelectionRequest): Selection {
  const byPid = new Map(request.table.map((process) => [process.pid, process]));
  const self = byPid.get(request.self);
  const ownChain = new Set([request.self, ...(self === undefined ? [] : ancestorsOf(byPid, self).map((p) => p.pid))]);
  const protectedNames = new Set((request.protectedNames ?? defaultProtectedNames).map(baseName));
  const isProtected = (process: ProcessInfo) => protectedNames.has(baseName(process.name));
  const direct = new Map(request.table.map((process) => [process.pid, directEvidence(process, request)]));

  const standingOf = (process: ProcessInfo): Standing => {
    if (ownChain.has(process.pid)) return { kind: "own" };
    const walk = [process, ...ancestorsOf(byPid, process)];
    const joinsOwnChain = walk.findIndex((candidate) => ownChain.has(candidate.pid));
    const outside = joinsOwnChain === -1 ? walk : walk.slice(0, joinsOwnChain);
    const anchor = joinsOwnChain === -1 ? undefined : walk[joinsOwnChain];
    const below = outside.at(-1);
    if (anchor?.pid === request.self) return { kind: "own" };
    if (anchor !== undefined && below !== undefined && isProtected(anchor) && !shellNames.has(baseName(below.name)))
      return { kind: "own" };

    const evidence =
      direct.get(process.pid) ??
      (outside.slice(1).some((ancestor) => direct.get(ancestor.pid) !== undefined) ? "descendant" : undefined);
    return { kind: "candidate", evidence, protectedBy: outside.find(isProtected)?.pid };
  };

  const entries = request.table
    .flatMap((process): readonly OwnedProcess[] => {
      const standing = standingOf(process);
      if (standing.kind === "own" || standing.evidence === undefined) return [];
      const parent = parentOf(byPid, process);
      const orphaned = parent === undefined || parent.pid <= 1 || initNames.has(baseName(parent.name));
      const base = { process, evidence: standing.evidence, orphaned };
      return [standing.protectedBy === undefined ? base : { ...base, protectedBy: standing.protectedBy }];
    })
    .toSorted(
      (left, right) =>
        ancestorsOf(byPid, left.process).length - ancestorsOf(byPid, right.process).length ||
        left.process.pid - right.process.pid,
    );

  return {
    owned: entries.filter((entry) => entry.protectedBy === undefined),
    protected: entries.filter((entry) => entry.protectedBy !== undefined),
  };
}

/** Owned processes left without a live parent, and everything below them: what nobody will stop anymore. */
export function orphanedTrees(table: readonly ProcessInfo[], owned: readonly OwnedProcess[]): readonly OwnedProcess[] {
  const byPid = new Map(table.map((process) => [process.pid, process]));
  const roots = new Set(owned.filter((entry) => entry.orphaned).map((entry) => entry.process.pid));
  return owned.filter(
    (entry) => roots.has(entry.process.pid) || ancestorsOf(byPid, entry.process).some((a) => roots.has(a.pid)),
  );
}
