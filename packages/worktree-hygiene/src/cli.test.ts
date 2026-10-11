import { describe, expect, it } from "vitest";
import { type CliContext, exitCodes, runCli } from "./cli.ts";
import type { ProcessInfo } from "./ownership.ts";
import { type Snapshot, SnapshotError } from "./process-table.ts";
import { ScopeError } from "./worktree.ts";

const root = process.platform === "win32" ? "C:\\wt\\a" : "/wt/a";
const inRoot = (file: string) => `${root}${process.platform === "win32" ? "\\" : "/"}${file}`;
const row = (pid: number, ppid: number, commandLine: string): ProcessInfo => ({
  pid,
  ppid,
  name: "node",
  commandLine,
  started: pid,
});

/** The caller (30, under shell 20), one orphaned dev server of the worktree (60), listening on 24260. */
const tableWithLeftover = [row(20, 1, "bash"), row(30, 20, "node cli.js"), row(60, 999, `node ${inRoot("vite.js")}`)];

function harness(
  tables: readonly (readonly ProcessInfo[])[],
  listeners: Snapshot["listeners"] | "unmapped" = [{ port: 24_260, pid: 60 }],
) {
  const out: string[] = [];
  const err: string[] = [];
  const signals: string[] = [];
  const queue = [...tables];
  const context: CliContext = {
    cwd: root,
    pid: 30,
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    resolveWorktree: async (directory) => ({ root: directory, worktrees: [directory], nested: [] }),
    readSnapshot: async () => ({
      processes: queue.length > 1 ? (queue.shift() ?? []) : (queue[0] ?? []),
      listeners: listeners === "unmapped" ? undefined : listeners,
    }),
    signal: (pid, signal) => signals.push(`${signal} ${pid}`),
    graceMs: 0,
  };
  return { context, out: () => out.join(""), err: () => err.join(""), signals };
}

describe("worktree-hygiene done", () => {
  it("fails and lists what still runs, with its port", async () => {
    const run = harness([tableWithLeftover]);

    expect(await runCli(["done"], run.context)).toBe(exitCodes.violation);
    expect(run.out()).toMatch(/Still running from .* \(1\)\n +60 +node +\[command line, orphaned, listening 24260\]/u);
    expect(run.signals).toStrictEqual([]);
  });

  it("passes on a clean worktree", async () => {
    const run = harness([tableWithLeftover.slice(0, 2)]);

    expect(await runCli(["done", "--json"], run.context)).toBe(exitCodes.ok);
    expect(JSON.parse(run.out())).toMatchObject({ clean: true, leftovers: [] });
  });

  it("stops the leftovers with --reap, then passes once they are gone", async () => {
    const leftoverGone = tableWithLeftover.slice(0, 2);
    const run = harness([tableWithLeftover, tableWithLeftover, leftoverGone]);

    expect(await runCli(["done", "--reap"], run.context)).toBe(exitCodes.ok);
    expect(run.signals).toStrictEqual(["SIGTERM 60"]);
    expect(run.out()).toMatch(/^Clean/u);
  });
});

describe("worktree-hygiene reap", () => {
  it("prints the plan and signals nothing on --dry-run", async () => {
    const run = harness([tableWithLeftover]);

    expect(await runCli(["reap", "--dry-run", "--json"], run.context)).toBe(exitCodes.ok);
    expect(JSON.parse(run.out()).wouldStop.map((entry: { pid: number }) => entry.pid)).toStrictEqual([60]);
    expect(run.signals).toStrictEqual([]);
  });

  it("leaves a live, parented process alone without --all", async () => {
    const parented = [...tableWithLeftover.slice(0, 2), row(61, 20, `node ${inRoot("watch.js")}`)];
    const run = harness([parented]);

    expect(await runCli(["reap", "--dry-run", "--json"], run.context)).toBe(exitCodes.ok);
    expect(JSON.parse(run.out()).wouldStop).toStrictEqual([]);
  });

  it("fails when a process survives", async () => {
    const run = harness([tableWithLeftover]);

    expect(await runCli(["reap"], run.context)).toBe(exitCodes.violation);
    expect(run.err()).toMatch(/still running 60/u);
  });
});

describe("worktree-hygiene ports", () => {
  it("prints NAME_PORT lines", async () => {
    const run = harness([tableWithLeftover]);

    expect(await runCli(["ports", "game", "dev-worker", "--format", "env"], run.context)).toBe(exitCodes.ok);
    expect(run.out()).toMatch(/^GAME_PORT=\d+\nDEV_WORKER_PORT=\d+\n$/u);
  });

  it("fails --check when a process outside the worktree holds a derived port", async () => {
    const run = harness([tableWithLeftover]);
    await runCli(["ports", "game"], run.context);
    const { ports } = JSON.parse(run.out()) as { ports: { game: number } };
    const foreign = harness([[...tableWithLeftover, row(70, 1, "node elsewhere.js")]], [{ port: ports.game, pid: 70 }]);

    expect(await runCli(["ports", "game", "--check"], foreign.context)).toBe(exitCodes.violation);
    expect(foreign.err()).toMatch(new RegExp(`port ${ports.game} \\(game\\) is held by pid 70`, "u"));
  });

  it("reports --check as unavailable when ports cannot be mapped to processes", async () => {
    const run = harness([tableWithLeftover], "unmapped");

    expect(await runCli(["ports", "game", "--check"], run.context)).toBe(exitCodes.unavailable);
  });
});

describe("failures", () => {
  it.each([[[]], [["bogus"]], [["ports"]], [["ps", "extra"]], [["ps", "--nope"]], [["ports", "game", "--base", "x"]]])(
    "exits 2 on usage error %j",
    async (argv) => {
      const run = harness([tableWithLeftover]);

      expect(await runCli(argv, run.context)).toBe(exitCodes.usage);
      expect(run.err()).toMatch(/Usage: worktree-hygiene/u);
    },
  );

  it("exits 2 when the scope is refused", async () => {
    const run = harness([tableWithLeftover]);
    const context = {
      ...run.context,
      resolveWorktree: async () => {
        throw new ScopeError("Refusing /");
      },
    };

    expect(await runCli(["ps"], context)).toBe(exitCodes.usage);
  });

  it("exits 3 when the process table cannot be read, never a clean result", async () => {
    const run = harness([tableWithLeftover]);
    const context = {
      ...run.context,
      readSnapshot: async () => {
        throw new SnapshotError("powershell.exe missing");
      },
    };

    expect(await runCli(["done"], context)).toBe(exitCodes.unavailable);
    expect(run.err()).toMatch(/powershell\.exe missing/u);
  });
});

describe("the caller's own row", () => {
  it("exits 3 and signals nothing when the process table lacks the caller", async () => {
    const run = harness([tableWithLeftover.filter((process) => process.pid !== 30)]);

    expect(await runCli(["reap", "--all"], run.context)).toBe(exitCodes.unavailable);
    expect(run.err()).toMatch(/does not contain the caller \(pid 30\)/u);
    expect(run.signals).toStrictEqual([]);
  });
});

describe("the root a command is scoped to", () => {
  it("marks the root explicit only when --root names it", async () => {
    const calls: { directory: string; explicit: boolean | undefined }[] = [];
    const run = harness([tableWithLeftover]);
    const context: CliContext = {
      ...run.context,
      resolveWorktree: async (directory, options) => {
        calls.push({ directory, explicit: options?.explicit });
        return { root: directory, worktrees: [directory], nested: [] };
      },
    };
    await runCli(["ps"], context);
    await runCli(["ps", "--root", inRoot("sub")], context);

    expect(calls).toStrictEqual([
      { directory: root, explicit: false },
      { directory: inRoot("sub"), explicit: true },
    ]);
  });
});
