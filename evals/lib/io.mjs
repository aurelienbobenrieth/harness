import { readdir, readFile, mkdir, appendFile, writeFile, cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse } from "yaml";
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
export async function skills() {
  const result = [];
  for (const file of (await files(path.join(root, "skills"))).filter((p) => p.endsWith("SKILL.md"))) {
    const text = await readFile(file, "utf8");
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    const description = frontmatter ? parse(frontmatter)?.description : undefined;
    result.push({
      name: path.basename(path.dirname(file)),
      description: typeof description === "string" ? description : "",
    });
  }
  if (!result.length || result.some((s) => !s.description)) throw new Error("Empty or invalid skill descriptions");
  return result;
}
/** Consumer layout: discoverable skills plus verbatim always-on blocks and routing map. */
export async function fixture(name = "tiny") {
  if (!/^[\w-]+$/.test(name)) throw new Error("Invalid fixture name");
  const cwd = await mkdtemp(path.join(tmpdir(), "harness-eval-"));
  try {
    await cp(path.join(root, "evals/fixtures", name), cwd, { recursive: true });
    for (const folder of [".agents/skills", ".claude/skills"])
      await cp(path.join(root, "skills"), path.join(cwd, folder), { recursive: true });
    const inventory = await skills();
    let instructions = "# Fixture instructions\n";
    for (const file of (await files(path.join(root, "skills"))).filter((p) => path.basename(p) === "core.md")) {
      const skillName = path.basename(path.dirname(file));
      instructions += `\n<!-- harness:${skillName}:start -->\n${await readFile(file, "utf8")}\n<!-- harness:${skillName}:end -->\n`;
    }
    instructions +=
      "\nLoad the matching skill before acting:\n" + inventory.map((s) => `- ${s.name}: ${s.description}`).join("\n");
    await writeFile(path.join(cwd, "AGENTS.md"), instructions);
    await writeFile(path.join(cwd, "CLAUDE.md"), "@AGENTS.md\n");
    return { cwd, cleanup: () => rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) };
  } catch (error) {
    await rm(cwd, { recursive: true, force: true });
    throw error;
  }
}
export async function results(name) {
  const dir = path.join(root, "evals/results", name);
  await mkdir(dir, { recursive: true });
  const base = path.join(dir, new Date().toISOString().replaceAll(":", "-"));
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
