import path from "node:path";
import { parse as parseYaml } from "yaml";
import { globProject, isRecord, joinProject, readText } from "./project-files.js";

/** One readable `package.json` of the workspace. */
export type PackageManifest = {
  /** Project-relative directory, `""` for the root. */
  readonly directory: string;
  /** Project-relative manifest path. */
  readonly path: string;
  readonly name?: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly json: Readonly<Record<string, unknown>>;
};

/** What the workspace root declares: member manifests and pnpm catalogs. */
export type Workspace = {
  readonly manifests: readonly PackageManifest[];
  /** Catalog name to package to version spec. The default catalog is `default`. */
  readonly catalogs: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  /** Set when `pnpm-workspace.yaml` exists; `undefined` when absent, `false` when unreadable. */
  readonly pnpmWorkspace?: string | false;
  /** Manifests that exist but are not valid JSON objects. */
  readonly unreadable: readonly string[];
};

function stringRecord(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function workspacePatterns(rootJson: unknown, pnpm: unknown): readonly string[] {
  const fromPnpm = isRecord(pnpm) ? stringList(pnpm["packages"]) : [];
  const declared = isRecord(rootJson) ? rootJson["workspaces"] : undefined;
  const fromManifest = isRecord(declared) ? stringList(declared["packages"]) : stringList(declared);
  return [...fromPnpm, ...fromManifest];
}

function readCatalogs(pnpm: unknown): Map<string, Readonly<Record<string, unknown>>> {
  const catalogs = new Map<string, Readonly<Record<string, unknown>>>();
  if (!isRecord(pnpm)) return catalogs;
  const named = pnpm["catalogs"];
  if (isRecord(named))
    for (const [name, entries] of Object.entries(named)) if (isRecord(entries)) catalogs.set(name, entries);
  if (isRecord(pnpm["catalog"])) catalogs.set("default", pnpm["catalog"]);
  return catalogs;
}

/** Reads one `package.json`: `undefined` when absent, `"unreadable"` when it is not a JSON object. */
export async function readManifest(
  root: string,
  relative: string,
): Promise<PackageManifest | "unreadable" | undefined> {
  const text = await readText(path.join(root, relative));
  if (text === undefined) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return "unreadable";
  }
  if (!isRecord(json)) return "unreadable";
  const name = json["name"];
  return {
    directory: joinProject(path.posix.dirname(relative)),
    path: relative,
    ...(typeof name === "string" ? { name } : {}),
    scripts: stringRecord(json["scripts"]),
    json,
  };
}

/**
 * Loads the root manifest and every workspace member from `pnpm-workspace.yaml` `packages` or the root
 * `workspaces` field. `!` patterns exclude members.
 */
export async function loadWorkspace(root: string): Promise<Workspace> {
  const pnpmText = await readText(path.join(root, "pnpm-workspace.yaml"));
  let pnpm: unknown;
  let pnpmWorkspace: string | false | undefined;
  if (pnpmText !== undefined) {
    try {
      pnpm = parseYaml(pnpmText);
      pnpmWorkspace = "pnpm-workspace.yaml";
    } catch {
      pnpmWorkspace = false;
    }
  }
  const rootManifest = await readManifest(root, "package.json");
  const patterns = workspacePatterns(typeof rootManifest === "object" ? rootManifest.json : undefined, pnpm);
  const included = patterns.filter((pattern) => !pattern.startsWith("!"));
  const excluded = new Set(
    await globProject(
      root,
      patterns.filter((pattern) => pattern.startsWith("!")).map((pattern) => `${pattern.slice(1)}/package.json`),
      "workspace",
    ),
  );
  const members = await globProject(
    root,
    included.map((pattern) => `${pattern.replace(/\/+$/u, "")}/package.json`),
    "workspace",
  );
  const manifests: PackageManifest[] = [];
  const unreadable: string[] = [];
  for (const relative of ["package.json", ...members.filter((member) => !excluded.has(member))]) {
    const manifest = relative === "package.json" ? rootManifest : await readManifest(root, relative);
    if (manifest === "unreadable") unreadable.push(relative);
    else if (manifest !== undefined && !manifests.some((known) => known.path === manifest.path))
      manifests.push(manifest);
  }
  return {
    manifests,
    catalogs: readCatalogs(pnpm),
    ...(pnpmWorkspace === undefined ? {} : { pnpmWorkspace }),
    unreadable,
  };
}
