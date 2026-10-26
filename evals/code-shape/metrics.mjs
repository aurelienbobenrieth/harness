import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "../lib/io.mjs";
import { command, git } from "./fixture.mjs";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
function requireResult(result, label, allowed = [0, 1]) {
  if (result.error || !allowed.includes(result.status))
    throw Error(`${label}: ${result.error ?? result.stderr ?? result.stdout}`);
}
/** Report unavailable metrics as errors, never as zero findings. */
export async function metrics(cwd, base = "HEAD") {
  const folder = path.join(cwd, ".metrics");
  await mkdir(folder, { recursive: true });
  const { strictOxlintConfig } = await import(
    pathToFileURL(path.join(root, "packages/oxlint-config/dist/index.mjs"))
  );
  const plugins = [];
  const rules = {};
  for (const pkg of ["core", "effect"]) {
    const file = path.join(root, `packages/oxlint-plugin-${pkg}/dist/index.mjs`);
    const { default: plugin } = await import(pathToFileURL(file));
    plugins.push(pathToFileURL(file).href);
    for (const name of Object.keys(plugin.rules)) rules[`${pkg}/${name}`] = "error";
  }
  const config = {
    ...strictOxlintConfig,
    options: { ...strictOxlintConfig.options, typeAware: false, typeCheck: false },
    jsPlugins: plugins,
    rules: { ...strictOxlintConfig.rules, ...rules },
  };
  await writeFile(path.join(folder, "oxlint.json"), JSON.stringify(config));
  const lint = command(cwd, process.execPath, [
    path.join(root, "node_modules/oxlint/bin/oxlint"),
    "--threads=2",
    "--config",
    path.join(folder, "oxlint.json"),
    "--format=json",
    "src",
    "tests",
  ]);
  requireResult(lint, "oxlint");
  const findings = JSON.parse(lint.stdout).diagnostics;
  if (
    !Array.isArray(findings) ||
    findings.some((finding) =>
      /Error running JS plugin|Failed to load|panic/u.test(finding.message),
    )
  )
    throw Error("Oxlint failed to produce trustworthy findings");
  const tool = path.join(root, "node_modules/jscpd/run-jscpd.js");
  const duplication = command(cwd, process.execPath, [
    tool,
    "--reporters",
    "json",
    "--output",
    folder,
    "--min-lines",
    "3",
    "--min-tokens",
    "25",
    "src",
  ]);
  requireResult(duplication, "jscpd", [0]);
  const complexity = command(cwd, process.execPath, [
    tool,
    "--complexity",
    "--reporters",
    "json",
    "--output",
    folder,
    "src",
  ]);
  requireResult(complexity, "complexity", [0]);
  await writeFile(
    path.join(folder, "knip.json"),
    JSON.stringify({
      entry: ["src/api.ts", "tests/**/*.test.ts"],
      project: ["src/**/*.ts", "tests/**/*.ts"],
    }),
  );
  const dead = command(cwd, process.execPath, [
    path.join(root, "node_modules/knip/bin/knip.js"),
    "--config",
    path.join(folder, "knip.json"),
    "--reporter",
    "json",
    "--no-progress",
    "--include",
    "exports,types",
  ]);
  requireResult(dead, "knip");
  const issues = JSON.parse(dead.stdout).issues;
  if (!Array.isArray(issues)) throw Error("Invalid knip JSON");
  const duplicates = (await json(path.join(folder, "jscpd-report.json"))).statistics.total;
  const complexities = (await json(path.join(folder, "jscpd-complexity.json"))).summary.files.map(
    (file) => file.complexity,
  );
  const diff = git(cwd, "diff", base, "--numstat", "--", "src", "tests")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => line.split("\t"));
  const tests = command(cwd, process.execPath, ["check.mjs", "full"]);
  return {
    findings: findings.length,
    harnessFindings: findings.filter((finding) => /^(core|effect)\(/u.test(finding.code ?? ""))
      .length,
    duplicatedLines: duplicates.duplicatedLines,
    duplicationPercent: duplicates.percentage,
    cyclomaticTotal: complexities.reduce((a, b) => a + b, 0),
    cyclomaticMax: Math.max(0, ...complexities),
    deadExports: issues.reduce(
      (sum, issue) => sum + (issue.exports?.length ?? 0) + (issue.types?.length ?? 0),
      0,
    ),
    testsPass:
      tests.status === 0 &&
      /# tests [1-9]/u.test(tests.stdout) &&
      /# fail 0/u.test(tests.stdout) &&
      !/# skipped [1-9]/u.test(tests.stdout),
    testCount: Number(tests.stdout.match(/# tests (\d+)/u)?.[1] ?? 0),
    added: diff.reduce((sum, [add]) => sum + Number(add), 0),
    deleted: diff.reduce((sum, [, del]) => sum + Number(del), 0),
    raw: { lint, duplication, complexity, dead, tests },
  };
}
