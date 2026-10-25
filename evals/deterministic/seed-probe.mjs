import { repos, read, sourceFiles, safeWrite, lint, pluginConfig, normalizeSeedText } from "./common.mjs";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
export async function probeSeed(e, rawSeed, repo, index) {
  const seed = {
    ...rawSeed,
    source: normalizeSeedText(rawSeed.source),
    files: Object.fromEntries(Object.entries(rawSeed.files ?? {}).map(([p, v]) => [p, normalizeSeedText(v)])),
  };
  const cwd = repos[repo];
  const dir = mkdtempSync(path.join(tmpdir(), "det-seed-"));
  let hit = false,
    error,
    baselineHits = 0,
    findings = [];
  const start = performance.now();
  try {
    if (Object.keys(seed.files ?? {}).some((f) => /(^|[/])node_modules([/]|$)/.test(f)))
      throw Error("Fake tool fixtures are not permitted");
    if (e.kind === "oxlint") {
      const real =
        sourceFiles(cwd)
          .filter((f) => !f.startsWith(".") && !f.endsWith(".d.ts"))
          .find((f) => /\.(test|spec)\./.test(f) === /\.(test|spec)\./.test(seed.file)) ?? sourceFiles(cwd)[0];
      const base = read(path.join(cwd, real));
      safeWrite(dir, { ...seed.files, [seed.file]: base });
      const config = pluginConfig([e]);
      if (seed.options && Object.keys(seed.options).length) config.rules[e.id] = ["error", seed.options];
      const before = lint(config, path.join(dir, seed.file), dir);
      baselineHits = before.diagnostics.filter((d) => d.code === e.id.replace(/\/([^/]+)$/, "($1)")).length;
      safeWrite(dir, {
        [seed.file]: e.id === "core/no-reexport-only-modules" ? seed.source : base + "\n" + seed.source + "\n",
      });
      const after = lint(config, path.join(dir, seed.file), dir);
      findings = after.diagnostics;
      error = after.error ?? (after.crashes.length ? JSON.stringify(after.crashes) : undefined);
      const parseErrors = findings.filter((d) => !d.code || /parse|syntax/i.test(d.code));
      if (parseErrors.length) error = "Invalid seeded syntax: " + JSON.stringify(parseErrors).slice(0, 300);
      hit = !error && findings.filter((d) => d.code === e.id.replace(/\/([^/]+)$/, "($1)")).length > baselineHits;
      seed.consumerFile = real;
    } else {
      const options = seed.options ?? {};
      if (options.closedDesignSystem?.buildCommand) throw Error("Generated commands are not executed");
      const baseline = {};
      for (const file of Object.keys(seed.files ?? {})) {
        const full = path.resolve(cwd, file);
        if (!full.startsWith(path.resolve(cwd) + path.sep)) throw Error("Unsafe baseline path");
        if (existsSync(full)) baseline[file] = read(full);
      }
      safeWrite(dir, baseline);
      let before = [];
      try {
        before = await e.rule.run({ now: "2026-10-25", ...options, root: dir });
      } catch {}
      baselineHits = before.filter((f) => !f.evaluation).length;
      safeWrite(dir, seed.files ?? {});
      findings = await e.rule.run({ now: "2026-10-25", ...options, root: dir });
      error = findings.find((f) => f.evaluation)?.message;
      hit = !error && findings.some((f) => !f.evaluation);
    }
  } catch (err) {
    error = String(err);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { id: e.id, repo, index, seed, hit, error, baselineHits, ms: performance.now() - start, findings };
}
