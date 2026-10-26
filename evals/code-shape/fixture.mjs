import { mkdir, symlink, writeFile, readFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fixture, root, files } from "../lib/io.mjs";

export function command(cwd, file, args, timeout = 120000) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(file, args, {
    cwd,
    encoding: "utf8",
    env,
    timeout,
    windowsHide: true,
    maxBuffer: 8e6,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message,
  };
}
export const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true, maxBuffer: 8e6 }).trim();
export async function sources(cwd) {
  const result = {};
  for (const folder of ["src", "tests"]) {
    for (const file of await files(path.join(cwd, folder)))
      result[path.relative(cwd, file).replaceAll("\\", "/")] = await readFile(file, "utf8");
  }
  return result;
}
export async function createFixture(ref) {
  const workspace = await fixture("code-shape", ref);
  try {
    await mkdir(path.join(workspace.cwd, "node_modules"));
    // Reuse the lockfile's real Effect installation, never a handwritten replacement.
    await symlink(
      path.join(root, "node_modules/.pnpm/effect@4.0.0-rc.115/node_modules/effect"),
      path.join(workspace.cwd, "node_modules/effect"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await writeFile(
      path.join(workspace.cwd, ".gitignore"),
      "node_modules/\n.agents/\n.claude/\nAGENTS.md\nCLAUDE.md\n.metrics/\n",
    );
    git(workspace.cwd, "init", "-q");
    git(workspace.cwd, "config", "user.name", "Shape Eval");
    git(workspace.cwd, "config", "user.email", "shape@example.invalid");
    git(workspace.cwd, "add", "--", "src", "tests", "README.md", "package.json", "check.mjs", ".gitignore");
    git(workspace.cwd, "commit", "-qm", "feat: parcel desk fixture");
    return workspace;
  } catch (error) {
    await workspace.cleanup();
    throw error;
  }
}
