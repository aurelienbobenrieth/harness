import { execFileSync } from "node:child_process";
import { readdir, readFile, mkdir, appendFile, writeFile, cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { randomUUID } from "node:crypto";
export const root = path.resolve(import.meta.dirname, "../..");
export async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const e of entries) {
    if (e.isSymbolicLink()) throw new Error(`Symlink not allowed: ${e.name}`);
    const p = path.join(dir, e.name);
    if (e.isDirectory()) result.push(...(await files(p)));
    else result.push(p);
  }
  return result.toSorted();
}
const sourceCache = new Map();
export function skillsRevision(ref) {
  if (ref && sourceCache.has(ref)) return sourceCache.get(ref).revision;
  return ref === "none"
    ? "none"
    : execFileSync("git", ["rev-parse", "--verify", `${ref ?? "HEAD"}^{commit}`], {
        cwd: root,
        encoding: "utf8",
      }).trim();
}
export async function skillFiles(ref) {
  if (ref && sourceCache.has(ref)) return sourceCache.get(ref);
  if (ref === "none") return [];
  if (!ref)
    return Promise.all(
      (await files(path.join(root, "skills"))).map(async (file) => ({
        file: path.relative(root, file).replaceAll("\\", "/"),
        text: await readFile(file, "utf8"),
      })),
    );
  const sha = execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const sources = execFileSync("git", ["ls-tree", "-r", "--name-only", sha, "--", "skills"], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((file) => ({
      file,
      text: execFileSync("git", ["show", `${sha}:${file}`], { cwd: root, encoding: "utf8" }),
    }));
  sources.revision = sha;
  sourceCache.set(ref, sources);
  return sources;
}
export async function skills(ref) {
  const result = [];
  for (const { file, text } of (await skillFiles(ref)).filter((s) => s.file.endsWith("SKILL.md"))) {
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    const description = frontmatter ? parse(frontmatter)?.description : undefined;
    result.push({
      name: path.basename(path.dirname(file)),
      description: typeof description === "string" ? description : "",
    });
  }
  if ((ref !== "none" && !result.length) || result.some((s) => !s.description))
    throw new Error("Empty or invalid skill descriptions");
  return result;
}
/** Consumer layout: discoverable skills plus verbatim always-on blocks and routing map. */
export async function fixture(name = "tiny", ref) {
  if (!/^[\w-]+$/.test(name)) throw new Error("Invalid fixture name");
  const cwd = await mkdtemp(path.join(tmpdir(), "harness-eval-"));
  try {
    await cp(path.join(root, "evals/fixtures", name), cwd, { recursive: true });
    const sources = await skillFiles(ref);
    for (const folder of [".agents/skills", ".claude/skills"])
      for (const { file, text } of sources) {
        const target = path.join(cwd, folder, file.slice(7));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, text);
      }
    const inventory = await skills(ref);
    let instructions = "# Fixture instructions\n";
    for (const { file, text } of sources.filter((s) => path.basename(s.file) === "core.md")) {
      const skillName = path.basename(path.dirname(file));
      instructions += `\n<!-- harness:${skillName}:start -->\n${text}\n<!-- harness:${skillName}:end -->\n`;
    }
    if (ref !== "none")
      instructions +=
        "\nLoad the matching skill before acting:\n" +
        inventory.map((s) => `- ${s.name}: ${s.description}`).join("\n");
    await writeFile(path.join(cwd, "AGENTS.md"), instructions);
    await writeFile(path.join(cwd, "CLAUDE.md"), "@AGENTS.md\n");
    return {
      cwd,
      cleanup: () => rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    };
  } catch (error) {
    await rm(cwd, { recursive: true, force: true });
    throw error;
  }
}
export async function results(name) {
  const dir = path.join(root, "evals/results", name);
  await mkdir(dir, { recursive: true });
  const base = path.join(dir, `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`);
  return {
    base,
    record: (row) => appendFile(base + ".jsonl", JSON.stringify(row) + "\n"),
    summary: (text) => writeFile(base + ".md", text),
  };
}
export function options() {
  const args = process.argv.slice(2),
    out = { include: [] };
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, "");
    if (key === "static") out.static = true;
    else if (args[i + 1] && !args[i + 1].startsWith("--")) {
      if (key === "include") out.include.push(args[++i]);
      else out[key] = args[++i];
    } else throw new Error(`Missing value: ${args[i]}`);
  }
  return out;
}
