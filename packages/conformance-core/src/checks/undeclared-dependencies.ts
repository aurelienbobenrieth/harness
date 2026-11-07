/**
 * Fails when a source file imports a package its own `package.json` does not declare. A package that resolves only
 * because the root or a sibling workspace member declares (and pnpm or npm hoists) it breaks the day that manifest
 * drops it. Reads the sources itself (the files git tracks or leaves unignored, else a directory walk), so it needs no analysis tool and always evaluates.
 *
 * @attribution Author's private workspace-boundaries phantom-dependency check (same author, concept re-implemented generically)
 */
import { isBuiltin } from "node:module";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { isRecord, parseJson, readTextFile } from "../fs-support.js";
import { scanImports } from "../import-scanner.js";
import { runTool } from "../tool-support.js";

const docs =
  "https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-core#undeclared-dependencies";
const maxListed = 10;
const maxFileBytes = 1_000_000;
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const skippedDirectories = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  ".output",
  ".svelte-kit",
  ".wrangler",
  ".alchemy",
  ".tanstack",
  ".cache",
  ".vercel",
  ".astro",
  ".stryker-tmp",
  ".tmp",
]);
/** Fixture directories (`fixtures`, `__fixtures__`, `__testfixtures__`, `test-fixtures`) hold deliberately incomplete sample projects. */
const fixtureDirectory = /fixtures?_*$/iu;
const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
/** A name npm accepts, optionally scoped. Aliases (`@/x`, `~/x`, `#x`) and runtime schemes (`cloudflare:workers`) are none. */
const packageName = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/u;

type Manifest = { readonly dir: string; readonly name: string | undefined; readonly declared: ReadonlySet<string> };

/** The package a specifier names, or undefined for relative paths, builtins, aliases and runtime schemes. */
export function packageOf(specifier: string): string | undefined {
  if (specifier.startsWith(".") || specifier.startsWith("/") || isBuiltin(specifier)) return undefined;
  const segments = specifier.split("/");
  const name = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
  return name !== undefined && packageName.test(name) ? name : undefined;
}

function typesPackageOf(name: string): string {
  return `@types/${name.replace(/^@/u, "").replace("/", "__")}`;
}

function parseManifest(dir: string, text: string | undefined): Manifest | undefined {
  const parsed = parseJson(text);
  if (!isRecord(parsed)) return undefined;
  const declared = new Set<string>();
  for (const field of dependencyFields) {
    const entries = parsed[field];
    if (isRecord(entries)) for (const name of Object.keys(entries)) declared.add(name);
  }
  // A nested manifest with neither a name nor dependencies is a module-format marker (`{"type":"module"}`), not a package.
  if (dir !== "" && typeof parsed["name"] !== "string" && declared.size === 0) return undefined;
  return { dir, name: typeof parsed["name"] === "string" ? parsed["name"] : undefined, declared };
}

function isExcluded(relative: string, excluded: readonly string[]): boolean {
  return excluded.some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`));
}

/** Lists the non-ignored files of a git checkout, or undefined when `root` is no git work tree or git is unavailable. */
async function gitFiles(root: string): Promise<readonly string[] | undefined> {
  const result = await runTool("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
  });
  if (result.failed || result.timedOut || result.stdout === "") return undefined;
  return result.stdout.split("\u0000").filter((entry) => entry !== "");
}

async function walkFiles(root: string, directory: string, files: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(path.join(root, directory), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const relative = directory === "" ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) await walkFiles(root, relative, files);
    } else if (entry.isFile()) files.push(relative);
  }
}

/** Splits the repository's files into package manifests (by directory) and scannable sources. */
async function collect(
  root: string,
  excluded: readonly string[],
): Promise<{ readonly manifests: Map<string, Manifest>; readonly sources: readonly string[] }> {
  let files = await gitFiles(root);
  if (files === undefined) {
    const walked: string[] = [];
    await walkFiles(root, "", walked);
    files = walked;
  }
  const manifests = new Map<string, Manifest>();
  const sources: string[] = [];
  // Deno projects resolve imports through an import map, not package.json.
  const denoDirectories = files
    .filter((file) => /(?:^|\/)deno\.jsonc?$/u.test(file))
    .map((file) => path.posix.dirname(file).replace(/^\.$/u, ""));
  for (const file of files) {
    const segments = file.split("/");
    const name = segments.at(-1) ?? "";
    const directories = segments.slice(0, -1);
    if (
      directories.some((segment) => skippedDirectories.has(segment) || fixtureDirectory.test(segment)) ||
      isExcluded(file, excluded) ||
      denoDirectories.some((directory) => directory === "" || isExcluded(file, [directory]))
    )
      continue;
    if (name === "package.json") {
      const directory = segments.slice(0, -1).join("/");
      const manifest = parseManifest(directory, await readTextFile(path.join(root, file)));
      if (manifest !== undefined) manifests.set(directory, manifest);
    } else if (sourceExtensions.has(path.extname(name)) && !name.endsWith(".d.ts")) sources.push(file);
  }
  return { manifests, sources };
}

const nonShippingFile =
  /(?:\.(?:test|spec|test-d|bench)\.[cm]?[jt]sx?$|\.config\.[cm]?[jt]s$|^(?:vitest|vite|tsdown|eslint|oxlint|oxfmt|jest|playwright)[.\w-]*\.[cm]?[jt]s$|^\.eslintrc\.[cm]?js$|(?:^|[.-])setup\.[cm]?[jt]sx?$)/u;
const nonShippingDirectory = new Set(["test", "tests", "__tests__", "__mocks__", "e2e"]);
const memberToolDirectory = new Set(["scripts", "tools"]);

/** Test, spec, tool-config files and member-level scripts/tools directories never ship to consumers. */
function isNonShipping(file: string, owner: Manifest): boolean {
  const segments = file.split("/");
  const name = segments.at(-1) ?? "";
  if (nonShippingFile.test(name)) return true;
  if (segments.slice(0, -1).some((segment) => nonShippingDirectory.has(segment))) return true;
  const inMember = owner.dir === "" ? segments : segments.slice(owner.dir.split("/").length);
  return inMember.length > 1 && memberToolDirectory.has(inMember[0] ?? "");
}

/** The directories from `dir` up to the workspace root, nearest first. */
function ancestorDirectories(dir: string): readonly string[] {
  const result: string[] = [];
  let current = dir;
  while (current !== "") {
    result.push(current);
    current = current.includes("/") ? current.slice(0, current.lastIndexOf("/")) : "";
  }
  return [...result, ""];
}

/** The manifest of the nearest ancestor directory holding a package.json. */
function ownerOf(file: string, manifests: ReadonlyMap<string, Manifest>): Manifest | undefined {
  let directory = path.posix.dirname(file);
  for (;;) {
    const normalized = directory === "." ? "" : directory;
    const manifest = manifests.get(normalized);
    if (manifest !== undefined) return manifest;
    if (normalized === "") return undefined;
    directory = path.posix.dirname(normalized);
  }
}

export const undeclaredDependencies: ConformanceCheck = {
  id: "undeclared-dependencies",
  description:
    "Every package a runtime file imports is declared in the manifest of the workspace member that owns it; tests, tool configs and scripts may rely on an ancestor manifest.",
  docs,
  async run({ root, undeclaredDependencies: options }) {
    const { manifests, sources } = await collect(root, options?.excludePaths ?? []);
    const ignored = new Set(options?.ignorePackages ?? []);

    // manifest directory -> package -> files importing it
    const missing = new Map<string, Map<string, string[]>>();
    for (const file of sources.toSorted()) {
      const owner = ownerOf(file, manifests);
      if (owner === undefined) continue;
      // Non-shipping files may rely on any ancestor manifest; runtime files need their own.
      const satisfiers = isNonShipping(file, owner)
        ? ancestorDirectories(owner.dir).flatMap((dir) => manifests.get(dir) ?? [])
        : [owner];
      const text = await readTextFile(path.join(root, file));
      if (text === undefined || text.length > maxFileBytes) continue;
      for (const specifier of new Set(scanImports(text))) {
        const name = packageOf(specifier);
        if (
          name === undefined ||
          name === owner.name ||
          ignored.has(name) ||
          satisfiers.some((manifest) => manifest.declared.has(name) || manifest.declared.has(typesPackageOf(name)))
        )
          continue;
        const perPackage = missing.get(owner.dir) ?? new Map<string, string[]>();
        perPackage.set(name, [...(perPackage.get(name) ?? []), file]);
        missing.set(owner.dir, perPackage);
      }
    }

    const findings: ConformanceFinding[] = [];
    for (const [dir, perPackage] of [...missing].toSorted(([one], [other]) => one.localeCompare(other))) {
      const manifestPath = dir === "" ? "package.json" : `${dir}/package.json`;
      const entries = [...perPackage];
      const listed = entries
        .slice(0, maxListed)
        .map(([name, files]) => `${name} (${files[0]}${files.length > 1 ? `, +${files.length - 1} more` : ""})`)
        .join("; ");
      const overflow = entries.length > maxListed ? ` (+${entries.length - maxListed} more)` : "";
      findings.push({
        check: "undeclared-dependencies",
        severity: "error",
        path: manifestPath,
        message: `${manifestPath} does not declare ${entries.length} package(s) its files import: ${listed}${overflow}. Add each to this manifest (dependencies, or devDependencies for tests and tooling) instead of relying on the root or a sibling to provide it.`,
        docs,
      });
    }
    return findings;
  },
};
