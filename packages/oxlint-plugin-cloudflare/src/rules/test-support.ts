import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  readonly source: string;
};

type LintCodeOptions = {
  readonly filename?: string;
  readonly ruleOptions?: unknown;
  /** Diagnostic message the report must carry (matched against the JSON output). */
  readonly message?: RegExp;
};

async function lintCode(
  ruleName: string,
  code: string,
  options: LintCodeOptions = {},
  fix = false,
): Promise<LintResult> {
  const directory = await mkdtemp(path.join(tmpdir(), "oxlint-plugin-cloudflare-"));
  const configPath = path.join(directory, "oxlint.json");
  const sourcePath = path.join(directory, options.filename ?? "sample.ts");

  await mkdir(path.dirname(sourcePath), { recursive: true });
  const ruleConfig = options.ruleOptions === undefined ? "error" : ["error", options.ruleOptions];
  await writeFile(
    configPath,
    JSON.stringify(
      {
        categories: { correctness: "off" },
        jsPlugins: [`file:///${pluginPath}`],
        rules: { [ruleName]: ruleConfig },
      },
      null,
      2,
    ),
  );
  await writeFile(sourcePath, code);

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [oxlintBin, "--config", configPath, sourcePath, "--format", "json", ...(fix ? ["--fix"] : [])],
      { cwd: packageRoot },
    );
    return { stdout, stderr, exitCode: 0, source: await readFile(sourcePath, "utf8") };
  } catch (error) {
    if (typeof error === "object" && error !== null && "stdout" in error && "stderr" in error && "code" in error) {
      return {
        stdout: String(error.stdout),
        stderr: String(error.stderr),
        exitCode: Number(error.code),
        source: await readFile(sourcePath, "utf8"),
      };
    }
    throw error;
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
}

export async function assertRuleReports(ruleName: string, code: string, options?: LintCodeOptions): Promise<void> {
  const result = await lintCode(ruleName, code, options);
  assertHealthyResult(result);
  assert.equal(result.exitCode, 1);
  assert.match(result.stdout + result.stderr, diagnosticCodePattern(ruleName));
  if (options?.message !== undefined) assert.match(result.stdout, options.message);
}

/** Run the rule with `--fix` and assert the file content after the fix is applied. */
export async function assertRuleFixes(ruleName: string, code: string, expected: string): Promise<void> {
  const result = await lintCode(ruleName, code, {}, true);
  assert.equal(result.stderr, "", result.stderr);
  assert.equal(result.source, expected);
}

export async function assertRuleDoesNotReport(
  ruleName: string,
  code: string,
  options?: LintCodeOptions,
): Promise<void> {
  const result = await lintCode(ruleName, code, options);
  assertHealthyResult(result);
  assert.equal(result.exitCode, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, diagnosticCodePattern(ruleName));
}

function diagnosticCodePattern(ruleName: string): RegExp {
  const [pluginName, ruleId] = ruleName.split("/");
  return new RegExp(`"code":\\s*"${escapeRegExp(`${pluginName}(${ruleId})`)}"`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertHealthyResult(result: LintResult): void {
  assert.equal(result.stderr, "", result.stderr);
  const output = JSON.parse(result.stdout) as {
    diagnostics: { code?: string; message: string; labels?: unknown[] }[];
  };
  assert.ok(Array.isArray(output.diagnostics), result.stdout);
  for (const diagnostic of output.diagnostics) {
    assert.ok(diagnostic.code, diagnostic.message);
    assert.ok(diagnostic.labels && diagnostic.labels.length > 0, diagnostic.message);
    assert.doesNotMatch(diagnostic.message, /Error running JS plugin|Failed to parse|Maximum call stack/);
  }
}
