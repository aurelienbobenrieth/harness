/* eslint-disable no-await-in-loop -- Sequential engine and judge runs share a bounded budget. */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";

export const root = path.resolve(import.meta.dirname, "../..");
const pluginRoot = process.env.AGENTLINT_PLUGIN_ROOT ?? path.join(root, "packages");
const output = path.join(root, "evals/agentlint/local");
mkdirSync(output, { recursive: true });
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 100e6 }).trim();
export async function catalog() {
  const rules = [];
  for (const pkg of readdirSync(path.join(root, "packages")).filter((name) => name.startsWith("agentlint-plugin-"))) {
    const module = await import(pathToFileURL(path.join(pluginRoot, pkg, "dist/index.mjs")));
    for (const rule of Object.values(module)) {
      if (!rule?.binding?.id || !rule.detector || rules.some((entry) => entry.id === rule.binding.id)) continue;
      rules.push({ id: rule.binding.id, pkg, rule });
    }
  }
  if (rules.length !== 60) throw Error(`Expected 60 rules, found ${rules.length}`);
  return rules.toSorted((a, b) => a.id.localeCompare(b.id));
}
export const consumers = {
  keepcart: process.env.AGENTLINT_KEEPCART ?? "C:/Users/aurel/.t3/worktrees/harness/vol-c-keepcart",
  kitbois: process.env.AGENTLINT_KITBOIS ?? "C:/Users/aurel/Documents/root/projects/kitbois/custom",
  panache: process.env.AGENTLINT_PANACHE ?? "C:/Users/aurel/Documents/root/projects/aurelienbbn/panache",
  studio: process.env.AGENTLINT_STUDIO ?? "C:/Users/aurel/Documents/root/projects/aurelienbbn/studio",
};
export async function scan(cwd, entries) {
  const temporary = mkdtempSync(path.join(tmpdir(), "agentlint-review-"));
  const clone = path.join(temporary, "repo");
  try {
    const commit = git(cwd, "rev-parse", "HEAD");
    git(temporary, "clone", "--shared", "--quiet", "--no-checkout", cwd, clone);
    git(clone, "checkout", "--quiet", "--detach", commit);
    mkdirSync(path.join(clone, ".agentlint"), { recursive: true });
    const packages = [...new Set(entries.map((entry) => entry.pkg))];
    const imports = packages
      .map(
        (pkg, i) =>
          `import * as p${i} from ${JSON.stringify(pathToFileURL(path.join(pluginRoot, pkg, "dist/index.mjs")).href)};`,
      )
      .join("\n");
    const chunkSize = Number(process.env.AGENTLINT_CHUNK_SIZE ?? (/panache$/i.test(cwd) ? 100 : 0));
    if (!Number.isSafeInteger(chunkSize) || chunkSize < 0 || chunkSize > 200)
      throw Error("AGENTLINT_CHUNK_SIZE must be 0..200");
    if (chunkSize && entries.some((entry) => entry.rule.lifecycle === "state" && entry.rule.detector.scan !== "file"))
      throw Error("Chunking requires file-local state detectors");
    const stateEntries = chunkSize ? entries.filter((entry) => entry.rule.lifecycle === "state") : entries;
    const selected = packages
      .map(
        (_, i) =>
          `...Object.values(p${i}).filter(r=>r?.binding?.id && ${JSON.stringify(stateEntries.map((entry) => entry.id))}.includes(r.binding.id))`,
      )
      .join(",");
    const ignores = [
      ".agents/**",
      "**/*.min.js",
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/routeTree.gen.ts",
    ];
    const configure = () =>
      writeFileSync(
        path.join(clone, ".agentlint/config.ts"),
        `${imports}\nexport default {ignores:${JSON.stringify(ignores)},rules:[${selected}]};`,
      );
    configure();
    // A clone prevents check --all acceptance cleanup from mutating a consumer.
    const started = performance.now();
    const engine = process.env.AGENTLINT_ENGINE ?? path.join(root, "node_modules/@aurelienbbn/agentlint/dist/bin.mjs");
    const execute = (files = []) =>
      spawnSync(process.execPath, [engine, "check", "--all", "--base", "HEAD^", "--format", "jsonl", ...files], {
        cwd: clone,
        encoding: "utf8",
        timeout: 300000,
        maxBuffer: 100e6,
        windowsHide: true,
      });
    const files = chunkSize
      ? git(cwd, "ls-files", "-z")
          .split("\0")
          .filter(
            (file) =>
              /\.(?:[cm]?[jt]sx?|json)$/.test(file) && !file.startsWith(".agents/") && !file.startsWith(".agentlint/"),
          )
      : [];
    const batches = chunkSize
      ? Array.from({ length: Math.ceil(files.length / chunkSize) }, (_, index) =>
          files.slice(index * chunkSize, (index + 1) * chunkSize),
        )
      : [[]];
    if (!batches.length) throw Error("No supported files to measure");
    const unavailableFiles = [];
    const failedRuns = [];
    let firstError;
    let stdout = "",
      stderr = "";
    for (const batch of batches) {
      let result = execute(batch);
      const rejected = [...(result.stderr ?? "").matchAll(/^  (.+) \((?:tsx?|jsx?|json)\)$/gm)].map(
        (match) => match[1],
      );
      if (rejected.length && !result.error) {
        firstError ??= result.stderr;
        unavailableFiles.push(...rejected);
        ignores.push(...rejected);
        configure();
        result = execute(batch);
      }
      stdout += result.stdout ?? "";
      stderr += result.stderr ?? "";
      if (result.error || ![0, 1].includes(result.status))
        failedRuns.push(result.error?.message ?? result.stderr ?? "Engine failed");
      if (chunkSize) console.log("batch", batches.indexOf(batch) + 1, "/", batches.length, result.status);
    }
    const run = {
      stdout,
      stderr,
      status: failedRuns.length ? 2 : stdout ? 1 : 0,
      error: failedRuns.length ? { message: failedRuns.join("\n") } : undefined,
    };
    const records = run.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { type: "invalid", line };
        }
      });
    const findings = records.filter((record) => record.type === "finding");
    const ruleErrors = {};
    if (chunkSize) {
      const changedFiles = git(cwd, "diff", "--name-only", "-z", "HEAD^", "HEAD").split("\0").filter(Boolean);
      const before = {},
        after = {};
      for (const file of changedFiles) {
        try {
          before[file] = git(cwd, "show", "HEAD^:" + file);
        } catch {}
        try {
          after[file] = git(cwd, "show", "HEAD:" + file);
        } catch {}
      }
      for (const entry of entries.filter((candidate) => candidate.rule.lifecycle === "change")) {
        try {
          const changes = await testRuleOnChange({ rule: entry.rule, fixture: { before, after } });
          findings.push(
            ...changes.map((finding) => ({
              type: "finding",
              rule: { id: entry.id, authority: entry.rule.binding.authority },
              location: { file: finding.file, line: finding.line, column: finding.column },
              message: finding.message,
              snippet: finding.sourceSnippet,
            })),
          );
        } catch (error) {
          ruleErrors[entry.id] = String(error);
        }
      }
    }
    for (const finding of findings) {
      const file = path.resolve(clone, finding.location.file);
      if (!file.startsWith(clone + path.sep) || !existsSync(file)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      const line = finding.location.line ?? 1;
      finding.context = lines
        .slice(Math.max(0, line - 12), line + 20)
        .join("\n")
        .slice(0, 10000);
    }
    return {
      commit,
      engine,
      chunkSize,
      ruleErrors,
      ignores,
      unavailableFiles,
      firstError,
      ms: performance.now() - started,
      exit: run.status,
      error:
        run.error?.message ??
        (![0, 1].includes(run.status) ? run.stderr || "Engine failed without diagnostics" : undefined),
      stderr: run.stderr,
      records: records.filter((record) => record.type !== "finding"),
      findings,
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMain && ["judge", "backlog", "report"].includes(process.argv[2])) {
  const command = process.argv.splice(2, 1)[0];
  // Finish exporting scan support before a command imports it back from this module.
  setImmediate(async () => {
    try {
      if (command === "judge") await import("./judge.mjs");
      else if (command === "backlog") await import("./backlog.mjs");
      else await import("./report.mjs");
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
} else if (isMain) {
  const phase = process.argv[2] ?? "before";
  const all = await catalog();
  const entries = process.env.AGENTLINT_RULE ? all.filter((entry) => entry.id === process.env.AGENTLINT_RULE) : all;
  writeFileSync(
    path.join(output, `${phase}-catalog.json`),
    JSON.stringify(
      entries.map(({ id, pkg, rule }) => ({
        id,
        pkg,
        lifecycle: rule.lifecycle,
        standard: rule.standard,
        binding: rule.binding,
        detectorVersion: rule.detector.version,
      })),
      null,
      2,
    ),
  );
  for (const [name, cwd] of Object.entries(consumers)) {
    if (process.env.AGENTLINT_ONLY && process.env.AGENTLINT_ONLY !== name) continue;
    const result = await scan(cwd, entries);
    writeFileSync(path.join(output, `${phase}-${name}.json`), JSON.stringify(result, null, 2));
    console.log(
      name,
      result.commit,
      result.exit,
      result.findings.length,
      result.error ?? "",
      JSON.stringify(result.records).slice(0, 12000),
    );
  }
}
