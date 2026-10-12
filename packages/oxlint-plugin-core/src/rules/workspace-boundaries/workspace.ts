/**
 * Workspace discovery for `core/workspace-boundaries`: the root, its member globs, and each member manifest.
 *
 * Oxlint runs rule visitors synchronously, so this module reads the disk synchronously.
 *
 * @module
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type ExportKey, matchesDirectory } from "./boundaries.js";

/** A member before classification: its directory, package name, and `exports` keys. */
export type Manifest = {
  readonly dir: string;
  readonly name: string;
  readonly exports: readonly ExportKey[];
};

/** A workspace root and the member globs it declares. */
export type Workspace = {
  readonly root: string;
  readonly globs: readonly string[];
};

const skippedDirectories = new Set(["node_modules", ".git"]);

/**
 * The `exports` keys a manifest declares. No field, a string, an array, or a conditions object opens only `.`;
 * a subpath mapped to `null` is kept, closed, so it can shadow a wider pattern.
 */
export function exportKeys(exportsField: unknown): readonly ExportKey[] {
  if (typeof exportsField !== "object" || exportsField === null || Array.isArray(exportsField))
    return [{ key: ".", open: true }];

  const entries = Object.entries(exportsField);
  if (!entries.some(([key]) => key.startsWith("."))) return [{ key: ".", open: true }];

  return entries.filter(([key]) => key.startsWith(".")).map(([key, target]) => ({ key, open: target !== null }));
}

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/gu, "");
}

/** The `packages:` list of a pnpm-workspace.yaml, block style (`- glob` lines) or flow style (`[a, b]`). */
export function workspaceGlobs(yaml: string): readonly string[] {
  const lines = yaml.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.startsWith("packages:"));
  if (start === -1) return [];

  const inline = /^packages:\s*\[(?<list>[^\]]*)\]/u.exec(lines[start] ?? "")?.groups?.["list"];
  if (inline !== undefined)
    return inline
      .split(",")
      .map(unquote)
      .filter((glob) => glob !== "");

  const globs: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/u.test(line)) break;
    const glob = /^\s+-\s+(?<glob>"[^"]*"|'[^']*'|[^#\s]+)/u.exec(line)?.groups?.["glob"];
    if (glob !== undefined) globs.push(unquote(glob));
  }
  return globs;
}

function readJson(file: string): Record<string, unknown> | undefined {
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function packageJsonGlobs(file: string): readonly string[] | undefined {
  const workspaces = readJson(file)?.["workspaces"];
  const list =
    typeof workspaces === "object" && workspaces !== null && !Array.isArray(workspaces)
      ? (workspaces as Record<string, unknown>)["packages"]
      : workspaces;
  return Array.isArray(list) ? list.filter((glob): glob is string => typeof glob === "string") : undefined;
}

/**
 * The nearest ancestor of `file` that declares a workspace: a pnpm-workspace.yaml, else a package.json with a
 * `workspaces` field. `undefined` outside any workspace.
 */
export function findWorkspace(file: string): Workspace | undefined {
  const directory = path.dirname(file);
  const pnpmWorkspace = path.join(directory, "pnpm-workspace.yaml");
  if (existsSync(pnpmWorkspace)) return { root: directory, globs: workspaceGlobs(readFileSync(pnpmWorkspace, "utf8")) };

  const manifest = path.join(directory, "package.json");
  const globs = existsSync(manifest) ? packageJsonGlobs(manifest) : undefined;
  if (globs !== undefined) return { root: directory, globs };

  return directory === file ? undefined : findWorkspace(directory);
}

function childDirectories(root: string, directory: string): readonly string[] {
  const absolute = path.join(root, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !skippedDirectories.has(entry.name))
    .map((entry) => (directory === "" ? entry.name : `${directory}/${entry.name}`));
}

function descendants(root: string, directory: string): readonly string[] {
  return childDirectories(root, directory).flatMap((child) => [child, ...descendants(root, child)]);
}

/** Directories a positive glob names, expanded one segment at a time against the disk. */
function expand(root: string, segments: readonly string[], directory: string): readonly string[] {
  const [head, ...rest] = segments;
  if (head === undefined) return [directory];
  if (head === "**")
    return [directory, ...descendants(root, directory)].flatMap((candidate) => expand(root, rest, candidate));
  if (head.includes("*"))
    return childDirectories(root, directory)
      .filter((child) => matchesDirectory(head, child.split("/").at(-1) ?? ""))
      .flatMap((child) => expand(root, rest, child));
  return expand(root, rest, directory === "" ? head : `${directory}/${head}`);
}

function readManifest(root: string, dir: string): Manifest | undefined {
  const file = path.join(root, dir, "package.json");
  if (!existsSync(file)) return undefined;
  const manifest = readJson(file) ?? {};
  const name = typeof manifest["name"] === "string" ? manifest["name"] : dir;
  return { dir, name, exports: exportKeys(manifest["exports"]) };
}

function segmentsOf(glob: string): readonly string[] {
  return glob.split("/").filter((segment) => segment !== "" && segment !== ".");
}

/**
 * Members a workspace declares: every directory a positive glob names that holds a package.json, minus those a `!`
 * glob names. The workspace root itself is never a member.
 */
export function readManifests(workspace: Workspace): readonly Manifest[] {
  const excluded = workspace.globs.filter((glob) => glob.startsWith("!")).map((glob) => glob.slice(1));
  const directories = new Set(
    workspace.globs
      .filter((glob) => !glob.startsWith("!"))
      .flatMap((glob) => expand(workspace.root, segmentsOf(glob), ""))
      .filter((dir) => dir !== "" && !excluded.some((pattern) => matchesDirectory(pattern, dir))),
  );
  return [...directories].toSorted().flatMap((dir) => {
    const manifest = readManifest(workspace.root, dir);
    return manifest === undefined ? [] : [manifest];
  });
}
