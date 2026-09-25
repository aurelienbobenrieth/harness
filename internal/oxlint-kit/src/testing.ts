/**
 * Oxlint rule harness shared by the oxlint plugins' tests.
 *
 * Every call writes the code into a throwaway directory, runs the real oxlint
 * binary against the plugin's built output (`<packageRoot>/dist/index.mjs`) with
 * only the rule under test enabled, and asserts on oxlint's JSON report or on
 * the rewritten file. Build the plugin before running its tests.
 *
 * @module
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type LintResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  /** File content after oxlint ran; differs from the input only when a fix mode applied a rewrite. */
  readonly source: string;
};

export type LintCodeOptions = {
  /** Path of the linted file, relative to the temporary project. Defaults to `sample.ts`. */
  readonly filename?: string;
  /** Rule options, or a function of the temporary project directory that returns them. */
  readonly ruleOptions?: unknown;
  /** Extra files written into the temporary project, keyed by relative path. */
  readonly files?: Readonly<Record<string, string>>;
  /** Diagnostic message the report must carry (matched against the JSON output). */
  readonly message?: RegExp;
};

/** `fix` applies safe fixes (`--fix`); `suggestions` applies suggestions (`--fix-suggestions`). */
export type FixMode = "fix" | "suggestions";

export type RuleHarness = {
  /** Run oxlint once and return its raw output, exit code, and the file content afterwards. */
  readonly lintCode: (ruleName: string, code: string, options?: LintCodeOptions) => Promise<LintResult>;
  /** Assert the rule reports on `code` (exit code 1 and a diagnostic with the rule's code). */
  readonly assertRuleReports: (ruleName: string, code: string, options?: LintCodeOptions) => Promise<void>;
  /** Assert the rule stays silent on `code` (exit code 0 and no diagnostic with the rule's code). */
  readonly assertRuleDoesNotReport: (ruleName: string, code: string, options?: LintCodeOptions) => Promise<void>;
  /** Assert the rule reports, and return every diagnostic message for exact-count assertions. */
  readonly reportedMessages: (ruleName: string, code: string, options?: LintCodeOptions) => Promise<readonly string[]>;
  /** Run the rule with `--fix` and assert the file content after the fix is applied. */
  readonly assertRuleFixes: (ruleName: string, code: string, expected: string) => Promise<void>;
  /** Run the rule in a fix mode and return the rewritten source; oxlint's exit code is ignored. */
  readonly fixCode: (ruleName: string, code: string, mode?: FixMode) => Promise<string>;
};

type Diagnostic = { code?: string; message: string; labels?: unknown[] };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function diagnosticCodePattern(ruleName: string): RegExp {
  const [pluginName, ruleId] = ruleName.split("/");
  return new RegExp(`"code":\\s*"${escapeRegExp(`${pluginName}(${ruleId})`)}"`);
}

function assertHealthyResult(result: LintResult): readonly Diagnostic[] {
  assert.equal(result.stderr, "", result.stderr);
  assert.notEqual(result.stdout.trim(), "", `oxlint printed nothing (exit ${result.exitCode}): ${result.stderr}`);
  const output = JSON.parse(result.stdout) as { diagnostics: Diagnostic[] };
  assert.ok(Array.isArray(output.diagnostics), result.stdout);
  for (const diagnostic of output.diagnostics) {
    assert.ok(diagnostic.code, diagnostic.message);
    assert.ok(diagnostic.labels && diagnostic.labels.length > 0, diagnostic.message);
    assert.doesNotMatch(diagnostic.message, /Error running JS plugin|Failed to parse|Maximum call stack/);
  }
  return output.diagnostics;
}

/**
 * Bind the harness to one plugin package. `packageRoot` is the directory that
 * holds the plugin's `package.json`; oxlint is taken from the workspace root two
 * levels above it.
 */
export function createRuleHarness(packageRoot: string): RuleHarness {
  const workspaceRoot = path.resolve(packageRoot, "..", "..");
  const pluginPath = path.join(packageRoot, "dist", "index.mjs").replaceAll(path.sep, "/");
  const oxlintBin = path.join(workspaceRoot, "node_modules", "oxlint", "bin", "oxlint");
  const temporaryPrefix = `${path.basename(packageRoot)}-`;

  async function runOxlint(
    ruleName: string,
    code: string,
    options: LintCodeOptions,
    extraArguments: readonly string[],
  ): Promise<LintResult> {
    const directory = await mkdtemp(path.join(tmpdir(), temporaryPrefix));
    const configPath = path.join(directory, "oxlint.json");
    const sourcePath = path.join(directory, options.filename ?? "sample.ts");

    await Promise.all(
      Object.entries(options.files ?? {}).map(async ([relative, content]) => {
        const filePath = path.join(directory, relative);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, content);
      }),
    );
    await mkdir(path.dirname(sourcePath), { recursive: true });
    const ruleOptions =
      typeof options.ruleOptions === "function"
        ? (options.ruleOptions as (directory: string) => unknown)(directory)
        : options.ruleOptions;
    const ruleConfig = ruleOptions === undefined ? "error" : ["error", ruleOptions];
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
      // One thread per run: default all-core threading across many parallel test files starves processes.
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [oxlintBin, "--threads=1", "--config", configPath, sourcePath, "--format", "json", ...extraArguments],
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

  async function reportingResult(ruleName: string, code: string, options: LintCodeOptions = {}) {
    const result = await runOxlint(ruleName, code, options, []);
    const diagnostics = assertHealthyResult(result);
    assert.equal(result.exitCode, 1);
    assert.match(result.stdout + result.stderr, diagnosticCodePattern(ruleName));
    return { result, diagnostics };
  }

  return {
    lintCode: (ruleName, code, options = {}) => runOxlint(ruleName, code, options, []),
    async assertRuleReports(ruleName, code, options) {
      const { result } = await reportingResult(ruleName, code, options);
      if (options?.message !== undefined) assert.match(result.stdout, options.message);
    },
    async assertRuleDoesNotReport(ruleName, code, options = {}) {
      const result = await runOxlint(ruleName, code, options, []);
      assertHealthyResult(result);
      assert.equal(result.exitCode, 0, result.stdout + result.stderr);
      assert.doesNotMatch(result.stdout + result.stderr, diagnosticCodePattern(ruleName));
    },
    async reportedMessages(ruleName, code, options) {
      const { diagnostics } = await reportingResult(ruleName, code, options);
      return diagnostics.map((diagnostic) => diagnostic.message);
    },
    async assertRuleFixes(ruleName, code, expected) {
      const result = await runOxlint(ruleName, code, {}, ["--fix"]);
      assert.equal(result.stderr, "", result.stderr);
      assert.equal(result.source, expected);
    },
    async fixCode(ruleName, code, mode = "fix") {
      const result = await runOxlint(ruleName, code, {}, [mode === "fix" ? "--fix" : "--fix-suggestions"]);
      return result.source;
    },
  };
}
