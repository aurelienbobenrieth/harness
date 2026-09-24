import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, "..", "..");
const workspaceRoot = path.resolve(packageRoot, "..", "..");
const pluginPath = path.join(packageRoot, "dist", "index.mjs").replaceAll(path.sep, "/");
const oxlintBin = path.join(workspaceRoot, "node_modules", "oxlint", "bin", "oxlint");

type FixMode = "fix" | "suggestions";

/** Run oxlint with fixes applied against a throwaway file and return the rewritten source. */
export async function fixCode(ruleName: string, code: string, mode: FixMode = "fix"): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "oxlint-plugin-effect-fix-"));
  const configPath = path.join(directory, "oxlint.json");
  const sourcePath = path.join(directory, "sample.ts");

  await writeFile(configPath, JSON.stringify({ jsPlugins: [`file:///${pluginPath}`], rules: { [ruleName]: "error" } }));
  await writeFile(sourcePath, code);

  try {
    await execFileAsync(
      process.execPath,
      [oxlintBin, "--threads=1", "--config", configPath, mode === "fix" ? "--fix" : "--fix-suggestions", sourcePath],
      { cwd: packageRoot },
    ).catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "stdout" in error) return;
      throw error;
    });
    return await readFile(sourcePath, "utf8");
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
}
