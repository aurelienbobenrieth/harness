import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

const roots = new Set<string>();

/** Writes the files into a fresh temporary project, removed after the test. */
export async function createFixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "conformance-alchemy-"));
  roots.add(root);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

/** Makes the fixture a git work tree with isolated config, optionally committing some of its files. */
export function initGit(root: string, commit: readonly string[] = []): void {
  const git = (...args: string[]): void => {
    execFileSync("git", args, {
      cwd: root,
      stdio: "ignore",
      env: { ...process.env, GIT_CONFIG_GLOBAL: path.join(root, ".gitconfig-none"), GIT_CONFIG_NOSYSTEM: "1" },
    });
  };
  git("init", "-q");
  if (commit.length === 0) return;
  git("add", "-f", "--", ...commit);
  git("-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "commit", "-q", "-m", "fixture");
}

/** A stack file whose `state:` option is the given expression. */
export function stack(state: string, imports = 'import { localState } from "alchemy/State";'): string {
  return `import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
${imports}

export default Alchemy.Stack("App", { providers: Cloudflare.providers(), state: ${state} }, program);
`;
}

afterEach(async () => {
  const pending = [...roots];
  roots.clear();
  for (const root of pending) {
    if (path.dirname(root) !== path.resolve(tmpdir())) throw new Error(`Refusing to remove ${root}`);
    await rm(root, { recursive: true, force: true });
  }
});
