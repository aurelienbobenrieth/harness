import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { resolveWorktree, ScopeError } from "./worktree.ts";

const execFileAsync = promisify(execFile);
const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), "worktree-hygiene-scope-")));
  directories.push(directory);
  return directory;
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args], { timeout: 30_000, windowsHide: true });
}

/** A repository with one commit and a worktree nested under `.claude/worktrees/x`, like Claude Code creates. */
async function repositoryWithNestedWorktree(): Promise<string> {
  const root = await temporaryDirectory();
  await git(root, "init", "-q", "-b", "main");
  await git(
    root,
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@t",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "init",
  );
  await mkdir(path.join(root, ".claude", "worktrees"), { recursive: true });
  await git(root, "worktree", "add", "-q", "-b", "x", path.join(root, ".claude", "worktrees", "x"));
  return root;
}

afterAll(async () => {
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("resolving the worktree", () => {
  it("refuses a filesystem root, the home directory, and an ancestor of it", async () => {
    const home = homedir();

    await expect(resolveWorktree(path.parse(home).root, { explicit: true })).rejects.toBeInstanceOf(ScopeError);
    await expect(resolveWorktree(home, { explicit: true })).rejects.toBeInstanceOf(ScopeError);
    await expect(resolveWorktree(path.dirname(home), { explicit: true })).rejects.toBeInstanceOf(ScopeError);
  });

  it("refuses a directory outside git unless --root named it", async () => {
    const directory = await temporaryDirectory();
    const nested = path.join(directory, "nested");
    await mkdir(nested);

    await expect(resolveWorktree(nested)).rejects.toThrow(/not inside a git worktree/u);
    await expect(resolveWorktree(nested, { explicit: true })).resolves.toStrictEqual({
      root: nested,
      worktrees: [nested],
      nested: [],
    });
  });

  it("refuses a directory that does not exist", async () => {
    await expect(resolveWorktree(path.join(tmpdir(), "worktree-hygiene-missing"))).rejects.toBeInstanceOf(ScopeError);
  });

  it("climbs to the git top level and lists the worktrees nested inside it", { timeout: 30_000 }, async () => {
    const root = await repositoryWithNestedWorktree();
    const nested = path.join(root, ".claude", "worktrees", "x");

    const fromRoot = await resolveWorktree(path.join(root, ".claude"));
    expect(fromRoot.root).toBe(root);
    expect(fromRoot.nested).toStrictEqual([nested]);
    expect(fromRoot.worktrees).toStrictEqual([root, nested]);

    const fromNested = await resolveWorktree(nested);
    expect(fromNested.root).toBe(nested);
    expect(fromNested.nested).toStrictEqual([]);
    expect(fromNested.worktrees).toStrictEqual([nested, root]);
  });
});
