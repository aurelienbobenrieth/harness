import { execFile } from "node:child_process";
import path from "node:path";
import { joinProject, readText } from "./project-files.js";

/** Whether committed ignore rules cover one directory's `.alchemy/state/`. */
type IgnoreVerdict = {
  /** Project-relative directory holding the stack file. */
  readonly directory: string;
  readonly ignored: boolean;
  /** Ignore source that matched when it is not a committed `.gitignore` (global excludes, `.git/info/exclude`). */
  readonly uncommittedSource?: string;
  /** Files under `.alchemy/` that git already tracks. */
  readonly tracked: readonly string[];
};

type IgnoreEvidence = {
  readonly method: "git" | "gitignore-files";
  readonly verdicts: readonly IgnoreVerdict[];
};

type GitResult = { readonly code: number | string | undefined; readonly stdout: string };

function runGit(root: string, args: readonly string[], input?: string): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = execFile(
      "git",
      args,
      { cwd: root, windowsHide: true, timeout: 30_000, maxBuffer: 16 * 1024 * 1024, shell: false },
      (error, stdout) => resolve({ code: error === null ? 0 : (error.code ?? "failed"), stdout }),
    );
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(input ?? "");
  });
}

/** The probe path: the state directory Alchemy's `localState()` writes under the working directory. */
function probe(directory: string): string {
  return `${joinProject(directory, ".alchemy/state")}/`;
}

async function viaGit(root: string, directories: readonly string[]): Promise<IgnoreEvidence | undefined> {
  const inside = await runGit(root, ["rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") return undefined;
  const input = directories.map((directory) => `${probe(directory)}\0`).join("");
  const checked = await runGit(root, ["check-ignore", "--no-index", "--stdin", "-z", "-v", "-n"], input);
  if (checked.code !== 0 && checked.code !== 1) return undefined;
  const matches = new Map<string, { readonly source: string; readonly pattern: string }>();
  const fields = checked.stdout.split("\0");
  for (let index = 0; index + 3 < fields.length; index += 4)
    matches.set(fields[index + 3] ?? "", { source: fields[index] ?? "", pattern: fields[index + 2] ?? "" });
  const verdicts: IgnoreVerdict[] = [];
  for (const directory of directories) {
    const { source, pattern } = matches.get(probe(directory)) ?? { source: "", pattern: "" };
    const tracked = await runGit(root, ["ls-files", "-z", "--", joinProject(directory, ".alchemy")]);
    const trackedFiles = tracked.code === 0 ? tracked.stdout.split("\0").filter((file) => file !== "") : [];
    const matched = source !== "" && !pattern.startsWith("!");
    const committed = matched && path.basename(source) === ".gitignore" && !path.isAbsolute(source);
    verdicts.push({
      directory,
      ignored: committed,
      ...(matched && !committed ? { uncommittedSource: source } : {}),
      tracked: trackedFiles,
    });
  }
  return { method: "git", verdicts };
}

type Rule = { readonly base: string; readonly negate: boolean; readonly matcher: RegExp };

function globToRegExp(glob: string): string {
  let out = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob.charAt(index);
    if (glob.startsWith("**/", index)) {
      out += "(?:.*/)?";
      index += 2;
    } else if (glob.startsWith("**", index)) {
      out += ".*";
      index += 1;
    } else if (char === "*") out += "[^/]*";
    else if (char === "?") out += "[^/]";
    else if (char === "[") {
      const close = glob.indexOf("]", index + 1);
      if (close === -1) out += "\\[";
      else {
        out += `[${glob
          .slice(index + 1, close)
          .replace(/^!/u, "^")
          .replaceAll("\\", "\\\\")}]`;
        index = close;
      }
    } else if (char === "\\" && index + 1 < glob.length) {
      index += 1;
      out += glob.charAt(index).replaceAll(/[.*+?^${}()|[\]\\/]/gu, "\\$&");
    } else out += char.replaceAll(/[.*+?^${}()|[\]\\/]/gu, "\\$&");
  }
  return out;
}

/** Compiles one `.gitignore` file following git's pattern format; every probe segment is a directory. */
export function parseGitignore(content: string, base: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of content.split(/\r?\n/u)) {
    let line = raw.replace(/(?<!\\)\s+$/u, "");
    if (line === "" || line.startsWith("#")) continue;
    const negate = line.startsWith("!");
    if (negate) line = line.slice(1);
    line = line.replace(/\/+$/u, "");
    const anchored = line.includes("/");
    const body = globToRegExp(line.replace(/^\//u, ""));
    rules.push({ base, negate, matcher: new RegExp(anchored ? `^${body}$` : `^(?:.*/)?${body}$`, "u") });
  }
  return rules;
}

/** Git semantics: the last matching rule wins per path, and nothing under an ignored directory can be re-included. */
export function isIgnored(rules: readonly Rule[], target: string): boolean {
  const segments = target.split("/");
  for (let length = 1; length <= segments.length; length += 1) {
    const candidate = segments.slice(0, length).join("/");
    let ignored = false;
    for (const rule of rules) {
      if (rule.base !== "" && !candidate.startsWith(`${rule.base}/`)) continue;
      const relative = rule.base === "" ? candidate : candidate.slice(rule.base.length + 1);
      if (rule.matcher.test(relative)) ignored = !rule.negate;
    }
    if (ignored) return true;
  }
  return false;
}

async function viaFiles(root: string, directories: readonly string[]): Promise<IgnoreEvidence> {
  const cache = new Map<string, Rule[]>();
  const verdicts: IgnoreVerdict[] = [];
  for (const directory of directories) {
    const target = joinProject(directory, ".alchemy/state");
    const rules: Rule[] = [];
    const segments = target.split("/");
    for (let length = 0; length < segments.length; length += 1) {
      const base = segments.slice(0, length).join("/");
      if (!cache.has(base)) {
        const text = await readText(path.join(root, base, ".gitignore"));
        cache.set(base, text === undefined ? [] : parseGitignore(text, base));
      }
      rules.push(...(cache.get(base) ?? []));
    }
    verdicts.push({ directory, ignored: isIgnored(rules, target), tracked: [] });
  }
  return { method: "gitignore-files", verdicts };
}

/**
 * Asks git (`git check-ignore`, `git ls-files`) when the root is inside a work tree, so every ignore rule
 * git honors is applied; matches from global or `.git/info/exclude` rules are reported as uncommitted.
 * Without git, reads the `.gitignore` files from the root down to each directory.
 */
export async function alchemyStateIgnored(
  root: string,
  directories: readonly string[],
  useGit = true,
): Promise<IgnoreEvidence> {
  return (useGit ? await viaGit(root, directories) : undefined) ?? viaFiles(root, directories);
}
