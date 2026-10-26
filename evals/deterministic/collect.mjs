/* eslint-disable no-await-in-loop -- Sequential scans and judge calls bound memory and share one cost ledger. */
import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";
import {
  root,
  out,
  save,
  git,
  repos,
  sourceFiles,
  catalog,
  command,
  lint,
  pluginConfig,
  reportingRules,
} from "./common.mjs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stateFindings } from "./agentlint.mjs";
const entries = reportingRules(await catalog());
const rows = [],
  runs = [];
for (const [repo, cwd] of Object.entries(repos)) {
  console.log("reading", repo);
  const sources = sourceFiles(cwd);
  console.log(repo, sources.length, "files");
  save("inventory-" + repo, {
    commit: git(cwd, "rev-parse", "HEAD"),
    files: sources.length,
    dirty: git(cwd, "status", "--porcelain"),
  });
  for (const pkg of new Set(entries.filter((e) => e.kind === "oxlint").map((e) => e.pkg))) {
    const rules = entries.filter((e) => e.pkg === pkg),
      r = lint(pluginConfig(rules), cwd, cwd);
    runs.push({ repo, pkg, ms: r.ms, error: r.error, stderr: r.stderr, crashes: r.crashes });
    for (const e of rules)
      rows.push({
        repo,
        id: e.id,
        kind: e.kind,
        pkg,
        ms: r.ms,
        timeScope: "shared package wall time",
        error: r.error,
        crashes: r.crashes,
        findings: r.diagnostics.filter((d) => d.code === e.id.replace(/\/([^/]+)$/, "($1)")),
      });
  }
  save("findings", rows);
  save("performance", runs);
  for (const e of entries.filter((candidate) => candidate.kind === "conformance")) {
    const start = performance.now();
    let findings = [],
      error;
    try {
      findings = await e.rule.run({
        root: cwd,
        tsconfigStrictness: {},
        now: "2026-10-25",
        wranglerTypes: { timeoutMs: 30000 },
      });
    } catch (err) {
      error = String(err);
    }
    rows.push({ repo, id: e.id, kind: e.kind, pkg: e.pkg, ms: performance.now() - start, error, findings });
    save("findings", rows);
    save("performance", runs);
    console.log(repo, e.id, findings.length, error ?? "");
  }
  const changed = git(cwd, "diff", "--name-only", "HEAD^", "HEAD")
    .split("\n")
    .filter((f) => /\.[cm]?[jt]sx?$/.test(f));
  const before = {},
    after = {};
  for (const file of changed) {
    try {
      before[file] = git(cwd, "show", "HEAD^:" + file);
    } catch {}
    try {
      after[file] = git(cwd, "show", "HEAD:" + file);
    } catch {}
  }
  const state = await stateFindings(
    cwd,
    entries.filter((candidate) => candidate.kind === "agentlint" && candidate.rule.lifecycle === "state"),
  );
  runs.push({ repo, pkg: "agentlint-state", ...state.run, error: state.error, records: state.records });
  for (const e of entries.filter((candidate) => candidate.kind === "agentlint")) {
    const start = performance.now();
    let findings = [],
      error;
    try {
      findings =
        e.rule.lifecycle === "change"
          ? await testRuleOnChange({ rule: e.rule, fixture: { before, after } })
          : state.findings.filter((f) => f.ruleId === e.id);
    } catch (err) {
      error = String(err);
    }
    rows.push({
      repo,
      id: "agentlint/" + e.id,
      kind: e.kind,
      pkg: e.pkg,
      ms: e.rule.lifecycle === "change" ? performance.now() - start : state.run.ms,
      timeScope: e.rule.lifecycle === "change" ? "per-rule wall time" : "shared state engine wall time",
      error: e.rule.lifecycle === "change" ? error : state.error,
      scope: e.rule.lifecycle === "change" ? "HEAD^..HEAD" : "tracked sources",
      findings,
    });
  }
  const { strictOxlintConfig } = await import(pathToFileURL(path.join(root, "packages/oxlint-config/dist/index.mjs")));
  const r = lint(
    { ...strictOxlintConfig, options: { ...strictOxlintConfig.options, typeAware: false, typeCheck: false } },
    cwd,
    cwd,
  );
  runs.push({
    repo,
    pkg: "oxlint-config",
    ms: r.ms,
    error: r.error,
    stderr: r.stderr,
    hitCount: r.diagnostics.length,
    mode: "syntax-only; consumer type dependencies not installed in detached tree",
  });
  const { defaultOxfmtConfig } = await import(pathToFileURL(path.join(root, "packages/oxfmt-config/dist/index.mjs")));
  const config = path.join(out, "oxfmt.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(config, JSON.stringify(defaultOxfmtConfig));
  const fmt = command(
    process.execPath,
    [path.join(root, "node_modules/oxfmt/bin/oxfmt"), "--check", "--config", config, cwd],
    cwd,
  );
  runs.push({ repo, pkg: "oxfmt-config", ...fmt });
  save("findings", rows);
  save("performance", runs);
  console.log(repo, "completed", rows.filter((row) => row.repo === repo).length, "rules");
}
save(
  "catalog",
  entries.map(({ id, pkg, kind, name }) => ({ id: kind === "agentlint" ? "agentlint/" + id : id, pkg, kind, name })),
);
