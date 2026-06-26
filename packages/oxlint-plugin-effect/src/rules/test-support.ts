import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, "..", "..");
const workspaceRoot = path.resolve(packageRoot, "..", "..");
const pluginPath = path.join(packageRoot, "dist", "index.mjs").replaceAll(path.sep, "/");
const oxlintBin = path.join(workspaceRoot, "node_modules", "oxlint", "bin", "oxlint");

type LintResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export async function lintCode(ruleName: string, code: string): Promise<LintResult> {
  const directory = await mkdtemp(path.join(tmpdir(), "oxlint-plugin-effect-"));
  const configPath = path.join(directory, "oxlint.json");
  const sourcePath = path.join(directory, "sample.ts");

  await writeFile(
    configPath,
    JSON.stringify(
      {
        jsPlugins: [`file:///${pluginPath}`],
        rules: {
          [ruleName]: "error",
        },
      },
      null,
      2,
    ),
  );
  await writeFile(sourcePath, code);

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [oxlintBin, "--config", configPath, sourcePath, "--format", "json"],
      { cwd: packageRoot },
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    if (typeof error === "object" && error !== null && "stdout" in error && "stderr" in error && "code" in error) {
      return {
        stdout: String(error.stdout),
        stderr: String(error.stderr),
        exitCode: Number(error.code),
      };
    }
    throw error;
  }
}

export async function assertRuleReports(ruleName: string, code: string): Promise<void> {
  const result = await lintCode(ruleName, code);

  assert.notEqual(result.exitCode, 0);
  assert.match(result.stdout + result.stderr, diagnosticCodePattern(ruleName));
}

export async function assertRuleDoesNotReport(ruleName: string, code: string): Promise<void> {
  const result = await lintCode(ruleName, code);

  assert.doesNotMatch(result.stdout + result.stderr, diagnosticCodePattern(ruleName));
}

function diagnosticCodePattern(ruleName: string): RegExp {
  const [pluginName, ruleId] = ruleName.split("/");
  return new RegExp(`"code":\\s*"${escapeRegExp(`${pluginName}(${ruleId})`)}"`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
