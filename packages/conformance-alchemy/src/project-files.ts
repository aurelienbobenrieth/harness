import { glob, readFile } from "node:fs/promises";
import path from "node:path";
import type { ConformanceRunOptions } from "./finding.js";

/** Alchemy's CLI entrypoint when neither `--config` nor a positional file is given. */
export const defaultStackFile = "alchemy.run.ts";

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads a UTF-8 file, or undefined when it is absent or unreadable. */
export async function readText(absolute: string): Promise<string | undefined> {
  try {
    return await readFile(absolute, "utf8");
  } catch {
    return undefined;
  }
}

/** Rejects patterns that would read outside the project; they are caller errors. */
function assertInsideProject(pattern: string, option: string): void {
  if (pattern.trim() === "" || path.isAbsolute(pattern) || pattern.split(/[\\/]/u).includes(".."))
    throw new Error(`${option} entry must stay inside the project: ${JSON.stringify(pattern)}`);
}

/** Project-relative, forward-slash paths matching the globs, sorted, `node_modules` excluded. */
export async function globProject(root: string, patterns: readonly string[], option: string): Promise<string[]> {
  for (const pattern of patterns) assertInsideProject(pattern, option);
  const found = new Set<string>();
  for await (const file of glob(patterns, { cwd: root, exclude: ["**/node_modules/**"] }))
    found.add(file.split(path.sep).join("/"));
  return [...found].toSorted();
}

const sourceGlobs = ["**/*.{ts,mts,cts,js,mjs,cjs}"];
const sourceExcludes = ["**/node_modules/**", "**/dist/**", "**/.alchemy/**"];
const nonStackFile = /(?:\.d\.[cm]?ts|\.(?:test|spec)\.[cm]?[jt]s)$/u;
const alchemyImport = /\bfrom\s*["']alchemy(?:\/[^"']*)?["']|\brequire\(["']alchemy["']\)/u;
const stackFactoryCall = /\b(?:Alchemy\.)?Stack(?:\.make)?\s*\(|(?:^|[^\w.])alchemy\s*\(/mu;

/** True when the source imports `alchemy` and calls the stack factory (`Alchemy.Stack(...)`, `alchemy("app")`). */
function isStackSource(source: string): boolean {
  return alchemyImport.test(source) && stackFactoryCall.test(source);
}

/**
 * The stack entrypoints under review: `stackFiles` globs when set. Otherwise every `alchemy.run.ts` at any
 * depth (the CLI default, a fast path that needs no read) plus any other source file that imports `alchemy`
 * and calls its stack factory.
 */
export async function stackFiles(options: ConformanceRunOptions): Promise<string[]> {
  if (options.stackFiles?.length === 0) throw new Error("stackFiles must list at least one glob.");
  if (options.stackFiles !== undefined) return globProject(options.root, options.stackFiles, "stackFiles");
  const named = await globProject(options.root, [`**/${defaultStackFile}`], "stackFiles");
  const found = new Set(named);
  for await (const file of glob(sourceGlobs, { cwd: options.root, exclude: sourceExcludes })) {
    const relative = file.split(path.sep).join("/");
    if (found.has(relative) || nonStackFile.test(relative)) continue;
    const source = await readText(path.join(options.root, file));
    if (source !== undefined && isStackSource(source)) found.add(relative);
  }
  return [...found].toSorted();
}

/** The workflow directory, validated to stay inside the project. */
export function workflowsDir(options: ConformanceRunOptions): string {
  const directory = options.workflowsDir ?? ".github/workflows";
  assertInsideProject(directory, "workflowsDir");
  return directory.replaceAll("\\", "/").replace(/\/+$/u, "");
}

/** Joins project-relative posix segments; `""` is the project root. */
export function joinProject(...segments: readonly string[]): string {
  const joined = path.posix.normalize(segments.filter((segment) => segment !== "").join("/"));
  return joined === "." ? "" : joined.replace(/\/+$/u, "");
}
