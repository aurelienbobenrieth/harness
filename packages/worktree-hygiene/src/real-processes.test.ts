import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { runCli } from "./cli.ts";
import { readSnapshot } from "./process-table.ts";

const execFileAsync = promisify(execFile);

/**
 * Start a sleeper whose command line names `marker`, through a parent that exits at once: the sleeper is a real orphan,
 * like a dev server whose agent shell is gone.
 */
async function orphanNaming(marker: string): Promise<number> {
  const launcher = `
    const { spawn } = require("node:child_process");
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", ${JSON.stringify(marker)}], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    process.stdout.write(String(child.pid));
  `;
  const { stdout } = await execFileAsync(process.execPath, ["-e", launcher], { timeout: 15_000, windowsHide: true });
  return Number(stdout);
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    // REASON: ESRCH means the process is gone, which is what the caller asks about.
    return false;
  }
}

const started: number[] = [];
const directories: string[] = [];

afterAll(async () => {
  for (const pid of started) if (isRunning(pid)) process.kill(pid, "SIGKILL");
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("against the real process table", () => {
  it(
    "stops an orphan of the worktree and leaves a sibling checkout's orphan running",
    { timeout: 90_000 },
    async () => {
      const root = await realpath(await mkdtemp(path.join(tmpdir(), "worktree-hygiene-")));
      directories.push(root, `${root}-sibling`);
      const mine = await orphanNaming(path.join(root, "vite.js"));
      const sibling = await orphanNaming(path.join(`${root}-sibling`, "vite.js"));
      started.push(mine, sibling);

      const listed: string[] = [];
      const io = { cwd: root, pid: process.pid, stdout: (text: string) => listed.push(text), stderr: () => undefined };
      expect(await runCli(["ps", "--json"], io)).toBe(0);
      expect(JSON.parse(listed.join("")).owned.map((entry: { pid: number }) => entry.pid)).toStrictEqual([mine]);

      // --all: on Linux an orphan may be adopted by a session subreaper, not init; orphan detection is unit-tested.
      expect(await runCli(["reap", "--all", "--root", root], { ...io, stdout: () => undefined, graceMs: 5000 })).toBe(
        0,
      );
      expect(isRunning(mine)).toBe(false);
      expect(isRunning(sibling)).toBe(true);
      expect(await runCli(["done", "--root", root], { ...io, stdout: () => undefined })).toBe(0);
    },
  );

  it("reads a nonempty table that contains the test process itself", { timeout: 60_000 }, async () => {
    const snapshot = await readSnapshot();

    expect(snapshot.processes.some((entry) => entry.pid === process.pid && entry.started > 0)).toBe(true);
  });
});
