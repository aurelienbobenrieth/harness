/**
 * The worktree a command is scoped to: its root, its sibling worktrees, and the nested ones it must leave alone.
 *
 * @module
 */
import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { worktreeKey } from "./ports.js";

const execFileAsync = promisify(execFile);

export type Worktree = {
  /** Real absolute path of the worktree root. */
  readonly root: string;
  /** Every worktree of the repository, `root` included; just `[root]` outside git. */
  readonly worktrees: readonly string[];
  /** Worktrees inside `root`, whose processes belong to them, not to `root`. */
  readonly nested: readonly string[];
};

/** The requested root is too broad or not a directory; nothing ran. */
export class ScopeError extends Error {
  override readonly name = "ScopeError";
}

async function git(cwd: string, args: readonly string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], { timeout: 15_000, windowsHide: true });
    return stdout.trim();
  } catch {
    // REASON: not a git checkout, or git missing; the caller falls back to the directory it was given.
    return undefined;
  }
}

async function real(directory: string): Promise<string> {
  try {
    return await realpath(directory);
  } catch (error) {
    throw new ScopeError(`"${directory}" is not a readable directory.`, { cause: error });
  }
}

/** Worktree paths from `git worktree list --porcelain`. */
function parseWorktreeList(output: string): readonly string[] {
  return output
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)));
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export type ResolveOptions = {
  /**
   * `directory` was named by the caller (`--root`), so it is accepted as the worktree even outside git. A directory
   * only inferred from the current working directory must be a git checkout: `~/projects` would otherwise claim every
   * process of every project under it.
   */
  readonly explicit?: boolean;
};

/**
 * Resolve the worktree containing `directory` (git's top level, else `directory` itself when `explicit`). Refuses a
 * filesystem root, the home directory, or any of its ancestors: a scope that wide would claim unrelated processes.
 */
export async function resolveWorktree(directory: string, options: ResolveOptions = {}): Promise<Worktree> {
  const start = await real(directory);
  const topLevel = await git(start, ["rev-parse", "--show-toplevel"]);
  if ((topLevel === undefined || topLevel === "") && options.explicit !== true)
    throw new ScopeError(`"${start}" is not inside a git worktree; name the directory with --root to use it anyway.`);
  const root = topLevel === undefined || topLevel === "" ? start : await real(topLevel);

  const home = path.resolve(homedir());
  const key = worktreeKey(root);
  if (path.parse(root).root === root || key === worktreeKey(home) || isInside(root, home))
    throw new ScopeError(`Refusing "${root}": a filesystem root or home directory is not a worktree.`);

  const listed = await git(root, ["worktree", "list", "--porcelain"]);
  const others = await Promise.all(
    parseWorktreeList(listed ?? "").map((worktree) => real(worktree).catch(() => worktree)),
  );
  const worktrees = [root, ...others.filter((worktree) => worktreeKey(worktree) !== key)];
  return { root, worktrees, nested: worktrees.filter((worktree) => isInside(root, worktree)) };
}
