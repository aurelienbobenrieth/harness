/* eslint-disable no-await-in-loop -- Sequential scans and judge calls bound memory and share one cost ledger. */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
export const root = path.resolve(import.meta.dirname, "../..");
export const out = path.join(root, "evals/results/deterministic");
mkdirSync(out, { recursive: true });
export const read = (p) => readFileSync(p, "utf8");
export const save = (name, value) => writeFileSync(path.join(out, name + ".json"), JSON.stringify(value, null, 2));
export const load = (name) => JSON.parse(read(path.join(out, name + ".json")));
export const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 100e6 }).trim();
export const repos = {
  keepcart: "C:/Users/aurel/.t3/worktrees/harness/det-consumers/keepcart",
  kitbois: "C:/Users/aurel/Documents/root/projects/kitbois/custom",
  panache: "C:/Users/aurel/Documents/root/projects/aurelienbbn/panache",
  studio: "C:/Users/aurel/Documents/root/projects/aurelienbbn/studio",
};
const fileCache = new Map();
export const sourceFiles = (cwd) => {
  if (!fileCache.has(cwd))
    fileCache.set(
      cwd,
      git(cwd, "ls-files", "-z")
        .split("\0")
        .filter(
          (p) =>
            /\.[cm]?[jt]sx?$/.test(p) &&
            !/(^|\/)(dist|build|vendor|node_modules)\//.test(p) &&
            existsSync(path.join(cwd, p)),
        ),
    );
  return fileCache.get(cwd);
};
export const packages = readdirSync(path.join(root, "packages")).filter((n) =>
  /^(oxlint-plugin-|conformance-|agentlint-plugin-)/.test(n),
);
export async function catalog() {
  const all = [];
  for (const pkg of packages) {
    const mod = await import(pathToFileURL(path.join(root, "packages", pkg, "dist/index.mjs")));
    const docs = read(path.join(root, "packages", pkg, "README.md"));
    if (pkg.startsWith("oxlint-"))
      for (const [name, rule] of Object.entries(mod.default.rules))
        all.push({ id: mod.default.meta.name + "/" + name, pkg, kind: "oxlint", name, rule, docs });
    else if (pkg.startsWith("conformance-")) {
      const seen = new Set();
      for (const value of Object.values(mod))
        if (value && typeof value.run === "function" && value.id && !seen.has(value.id)) {
          seen.add(value.id);
          all.push({ id: pkg + "/" + value.id, pkg, kind: "conformance", name: value.id, rule: value, docs });
        }
    } else {
      const seen = new Set();
      for (const value of Object.values(mod))
        if (value?.binding?.id && value.detector && !seen.has(value.binding.id)) {
          seen.add(value.binding.id);
          all.push({
            id: value.binding.id,
            pkg,
            kind: "agentlint",
            name: value.binding.id.split("/").at(-1),
            rule: value,
            docs,
          });
        }
    }
  }
  return all;
}
export function command(file, args, cwd = root, timeout = 120000) {
  const start = performance.now();
  const r = spawnSync(file, args, { cwd, encoding: "utf8", windowsHide: true, timeout, maxBuffer: 100e6 });
  return {
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    exit: r.status,
    error: r.error?.message,
    ms: performance.now() - start,
  };
}
export function lint(config, target, cwd = root) {
  const dir = mkdtempSync(path.join(tmpdir(), "det-config-"));
  try {
    const configPath = path.join(dir, "oxlint.json");
    writeFileSync(configPath, JSON.stringify(config));
    const r = command(
      process.execPath,
      [
        path.join(root, "node_modules/oxlint/bin/oxlint"),
        "--threads=2",
        "--config",
        configPath,
        "--format=json",
        target,
      ],
      cwd,
    );
    try {
      r.diagnostics = JSON.parse(r.stdout).diagnostics;
      if (!Array.isArray(r.diagnostics)) throw Error("missing diagnostics");
    } catch {
      r.error ??= "Invalid oxlint JSON: " + r.stdout.slice(0, 500);
      r.diagnostics = [];
    }
    r.crashes = r.diagnostics.filter((d) =>
      /Error running JS plugin|panic|Maximum call stack|Failed to load/.test(d.message),
    );
    return r;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
export const pluginConfig = (entries) => ({
  categories: { correctness: "off" },
  jsPlugins: [...new Set(entries.map((e) => pathToFileURL(path.join(root, "packages", e.pkg, "dist/index.mjs")).href))],
  rules: Object.fromEntries(entries.map((e) => [e.id, "error"])),
});
export function excerpt(cwd, finding) {
  const file = finding.filename ?? finding.path ?? finding.file;
  if (!file) return "";
  const full = path.resolve(cwd, file);
  if (!full.startsWith(path.resolve(cwd) + path.sep) || !existsSync(full)) return "";
  const text = read(full),
    offset = finding.labels?.[0]?.span?.offset;
  const line =
    finding.labels?.[0]?.span?.line ??
    (offset === undefined
      ? (finding.line ?? 1)
      : Buffer.from(text, "utf8").subarray(0, offset).toString("utf8").split("\n").length);
  return text
    .split("\n")
    .slice(Math.max(0, line - 7), line + 9)
    .map((s, i) => `${Math.max(1, line - 6) + i}: ${s}`)
    .join("\n")
    .slice(0, 6000);
}
export function safeWrite(directory, files) {
  for (const [file, content] of Object.entries(files)) {
    const dest = path.resolve(directory, file);
    if (!dest.startsWith(path.resolve(directory) + path.sep)) throw Error("Unsafe seeded path");
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, content);
  }
}
/** Decode a whole-file extra escaping layer from generated fixtures; real source regexes stay literal. */
export function normalizeSeedText(text) {
  if (typeof text !== "string") return text;
  if (!text.includes("\n") && (text.startsWith("{\\") || text.endsWith("\\n") || /^(?:name|on|jobs):/.test(text)))
    return text.replaceAll("\\n", "\n").replaceAll('\\"', '"');
  return text;
}
