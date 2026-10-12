import { describe, expect, it } from "vitest";
import { mentionsWorktree, orphanedTrees, type ProcessInfo, selectWorktreeProcesses } from "./ownership.ts";

const row = (pid: number, ppid: number, name: string, commandLine = name, extra: Partial<ProcessInfo> = {}) => ({
  pid,
  ppid,
  name,
  commandLine,
  started: pid,
  ...extra,
});

describe("worktree mentions", () => {
  const posix = { root: "/work/a", platform: "linux" as const };
  const windows = { root: "C:\\Work\\A", platform: "win32" as const };

  it.each([
    ["node /work/a/node_modules/vite/bin/vite.js", true],
    ["node /work/a", true],
    ['node "/work/a/x.js"', true],
    ["node /work/ab/x.js", false],
    ["node /work/a-b/x.js", false],
    ["node /other/work/a/x.js", false],
    ["node file:///work/a/x.js", true],
    ["node --root=/work/a", true],
  ])("POSIX: %s → %s", (text, expected) => {
    expect(mentionsWorktree(text, posix)).toBe(expected);
  });

  it.each([
    ["C:\\work\\a\\node_modules\\.bin\\vite.cmd", true],
    ["node c:/work/a/x.js", true],
    ["tail -f /c/work/a/log.txt", true],
    ["node C:\\Work\\AB\\x.js", false],
    ["node C:\\Work\\A-sibling\\x.js", false],
    ["node --import file:///C:/Work/A/x.js", true],
    ["node D:\\Mirror\\C\\Work\\A\\x.js", false],
  ])("Windows, case-insensitive and Git Bash paths: %s → %s", (text, expected) => {
    expect(mentionsWorktree(text, windows)).toBe(expected);
  });

  it("leaves paths inside a nested worktree to that worktree", () => {
    const scope = { root: "/repo", nested: ["/repo/.claude/worktrees/x"], platform: "linux" as const };

    expect(mentionsWorktree("node /repo/.claude/worktrees/x/vite.js", scope)).toBe(false);
    expect(mentionsWorktree("node /repo/.claude/worktrees/xy/vite.js", scope)).toBe(true);
    expect(mentionsWorktree("node /repo/.claude/worktrees/x/a.js /repo/b.js", scope)).toBe(true);
  });
});

/**
 * A machine with: the caller (`worktree-hygiene`, 30) run by a tool shell (20) of a Claude Code session (10) in a
 * terminal (1); a dev server tree the same session started earlier through another shell (21 → 22 → 23); the
 * session's MCP server (24); an editor with a language server (40 → 41); another agent's dev server (50 → 51 → 52);
 * an orphaned esbuild whose parent died (60); a process of another checkout (70).
 */
const machine: readonly ProcessInfo[] = [
  row(1, 0, "init"),
  row(10, 1, "claude", "claude --cwd /wt/a"),
  row(20, 10, "bash", "bash -c worktree-hygiene done"),
  row(30, 20, "node", "node /wt/a/node_modules/.bin/worktree-hygiene done"),
  row(31, 30, "ps", "ps -A"),
  row(21, 10, "bash", "bash -c pnpm dev"),
  row(22, 21, "node", "node /usr/lib/pnpm.cjs dev"),
  row(23, 22, "node", "node vite.js", { cwd: "/wt/a" }),
  row(24, 10, "node", "node mcp-server.js", { cwd: "/wt/a" }),
  row(40, 1, "code", "code /wt/a"),
  row(41, 40, "node", "node tsserver.js /wt/a"),
  row(50, 1, "codex", "codex"),
  row(51, 50, "bash", "bash -c pnpm dev", { cwd: "/wt/a" }),
  row(52, 51, "node", "node vite.js"),
  row(60, 999, "esbuild", "/wt/a/node_modules/esbuild/bin/esbuild --service"),
  row(70, 1, "node", "node /wt/b/server.js"),
];

const select = (table: readonly ProcessInfo[] = machine) =>
  selectWorktreeProcesses({ table, root: "/wt/a", platform: "linux", self: 30 });
const pids = (entries: readonly { process: ProcessInfo }[]) => entries.map((entry) => entry.process.pid);

describe("worktree process selection", () => {
  it("selects the caller's own task processes and orphans, parents first", () => {
    expect(pids(select().owned)).toStrictEqual([60, 23]);
  });

  it("names the evidence of each owned process", () => {
    expect(Object.fromEntries(select().owned.map((entry) => [entry.process.pid, entry.evidence]))).toStrictEqual({
      23: "cwd",
      60: "command line",
    });
  });

  it("never selects the caller, its ancestors, its helpers, or its agent's MCP server", () => {
    const selected = new Set(pids([...select().owned, ...select().protected]));

    expect([1, 10, 20, 30, 31, 24].filter((pid) => selected.has(pid))).toStrictEqual([]);
  });

  it("reports editor and other-agent processes as protected, never as owned", () => {
    expect(Object.fromEntries(select().protected.map((entry) => [entry.process.pid, entry.protectedBy]))).toStrictEqual(
      {
        40: 40,
        41: 40,
        51: 50,
        52: 50,
      },
    );
  });

  it("protects extra names on request", () => {
    const selection = selectWorktreeProcesses({
      table: machine,
      root: "/wt/a",
      platform: "linux",
      self: 30,
      protectedNames: ["esbuild"],
    });

    expect(pids(selection.owned)).not.toContain(60);
  });

  it("marks a process whose parent is gone, replaced, or init as orphaned", () => {
    const table = [
      ...machine,
      row(80, 1, "node", "node /wt/a/x.js"),
      row(90, 70, "node", "node /wt/a/y.js", { started: 10 }),
    ];
    const orphaned = Object.fromEntries(select(table).owned.map((entry) => [entry.process.pid, entry.orphaned]));

    expect(orphaned).toMatchObject({ 60: true, 80: true, 90: true, 23: false });
  });

  it("selects a task process below the caller's agent when it points inside the worktree itself", () => {
    const table = [...machine, row(25, 21, "node", "node /wt/a/node_modules/vite/bin/vite.js")];

    expect(pids(select(table).owned)).toContain(25);
  });

  it("keeps only orphan roots and their descendants for a default reap", () => {
    const table = [...machine, row(61, 60, "node", "node child.js")];
    const { owned } = select(table);

    expect(pids(orphanedTrees(table, owned))).toStrictEqual([60, 61]);
  });

  it("selects nothing when no process points inside the worktree", () => {
    expect(selectWorktreeProcesses({ table: machine, root: "/wt/c", platform: "linux", self: 30 })).toStrictEqual({
      owned: [],
      protected: [],
    });
  });
});

describe("worktree mentions on UNC paths", () => {
  const scope = { root: "\\\\server\\share\\wt", platform: "win32" as const };

  it.each([
    ["node \\\\server\\share\\wt\\vite.js", true],
    ["node //server/share/wt/vite.js", true],
    ["node \\\\server\\share\\wtx\\vite.js", false],
    ["node \\\\server\\share-x\\wt\\vite.js", false],
  ])("%s → %s", (text, expected) => {
    expect(mentionsWorktree(text, scope)).toBe(expected);
  });
});

describe("ancestry with unknown start times", () => {
  it("does not orphan a worktree process whose parent row has no start time", () => {
    const table = [
      ...machine,
      row(100, 10, "bash", "bash -c pnpm dev", { started: 0 }),
      row(101, 100, "node", "node /wt/a/node_modules/vite/bin/vite.js"),
    ];
    const entry = select(table).owned.find((candidate) => candidate.process.pid === 101);

    expect(entry?.orphaned).toBe(false);
  });

  it("keeps the caller's chain whole when an ancestor has no start time, so its agent stays unselected", () => {
    const table = machine.map((process) => (process.pid === 20 ? { ...process, started: 0 } : process));
    const selected = new Set(pids([...select(table).owned, ...select(table).protected]));

    expect([1, 10, 20, 24].filter((pid) => selected.has(pid))).toStrictEqual([]);
  });
});

describe("agent hosts", () => {
  /**
   * An agent desktop host (T3 Code) above the caller's Claude session runs a second agent as a plain `node` process
   * whose task shell started a dev server in the worktree: that server belongs to the other agent.
   */
  const hosted = [
    row(1, 0, "init"),
    row(5, 1, "T3 Code (Nightly).exe", '"C:\\Programs\\T3 Code (Nightly).exe"'),
    row(10, 5, "claude.exe", "claude.exe --output-format stream-json"),
    row(20, 10, "cmd.exe", "cmd.exe /c worktree-hygiene done"),
    row(30, 20, "node.exe", "node.exe C:\\wt\\a\\node_modules\\.bin\\worktree-hygiene done"),
    row(50, 5, "node.exe", "node.exe acp-agent.js"),
    row(51, 50, "bash.exe", "bash -c pnpm dev"),
    row(52, 51, "node.exe", "node.exe C:\\wt\\a\\node_modules\\vite\\bin\\vite.js"),
    row(60, 999, "node.exe", "node.exe C:\\wt\\a\\node_modules\\esbuild\\bin\\esbuild"),
  ];

  it("never selects the processes of another agent hosted by the same desktop host", () => {
    const selection = selectWorktreeProcesses({ table: hosted, root: "C:\\wt\\a", platform: "win32", self: 30 });

    expect(pids(selection.owned)).toStrictEqual([60]);
    expect(pids(selection.protected)).toStrictEqual([]);
  });

  it("would select that agent's server if the desktop host were not a protected name", () => {
    const selection = selectWorktreeProcesses({
      table: hosted,
      root: "C:\\wt\\a",
      platform: "win32",
      self: 30,
      protectedNames: ["claude"],
    });

    expect(pids(selection.owned)).toStrictEqual([60, 52]);
  });
});
