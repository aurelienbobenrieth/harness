import path from "node:path";
import { fileExists, listDirectory, readTextFile } from "./fs-support.js";

/** Lists the package manifests declared by `pnpm-workspace.yaml`; single-level `dir/*` and literal entries are supported. */
export async function workspacePackageJsonPaths(root: string): Promise<readonly string[]> {
  const workspaceYaml = await readTextFile(path.join(root, "pnpm-workspace.yaml"));
  if (workspaceYaml === undefined) return [];

  // Best-effort YAML: collect `- pattern` entries under the top-level `packages:` key.
  const patterns: string[] = [];
  let inPackages = false;
  for (const rawLine of workspaceYaml.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^packages\s*:/.test(rawLine)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    if (line === "" || line.startsWith("#")) continue;
    if (!/^\s/.test(rawLine) && !line.startsWith("-")) {
      inPackages = false;
      continue;
    }
    if (line.startsWith("- ")) {
      patterns.push(line.slice(2).trim().replace(/^["']/, "").replace(/["']$/, ""));
    }
  }

  const results: string[] = [];
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) continue;
    if (pattern.endsWith("/*")) {
      const base = path.join(root, pattern.slice(0, -2));
      for (const entry of await listDirectory(base)) {
        const packageJsonPath = path.join(base, entry, "package.json");
        if (await fileExists(packageJsonPath)) results.push(packageJsonPath);
      }
      continue;
    }
    if (pattern.includes("*")) continue;
    const packageJsonPath = path.join(root, pattern, "package.json");
    if (await fileExists(packageJsonPath)) results.push(packageJsonPath);
  }
  return results;
}
