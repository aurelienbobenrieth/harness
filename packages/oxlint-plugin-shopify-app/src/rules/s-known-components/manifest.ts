import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Element and attribute vocabulary read from a Custom Elements Manifest. */
type ComponentVocabulary = ReadonlyMap<string, ElementVocabulary>;

/** Names one element accepts, pre-normalized for JSX lookups. */
type ElementVocabulary = {
  /** Attribute and property names, in their manifest, lowercase and kebab-case spellings. */
  readonly attributes: ReadonlySet<string>;
  /** Lowercase `on<event>` handler names. */
  readonly handlers: ReadonlySet<string>;
};

/** Outcome of locating a manifest: absent stays silent, unreadable is a configuration error. */
export type ManifestLookup =
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly file: string }
  | { readonly kind: "loaded"; readonly vocabulary: ComponentVocabulary };

const packageSegments = ["node_modules", "@shopify", "polaris-types", "package.json"];
const absent: ManifestLookup = { kind: "absent" };
const loadedFiles = new Map<string, ManifestLookup>();
const discoveredFiles = new Map<string, string | undefined>();

function spellings(name: string): readonly string[] {
  return [name, name.toLowerCase(), name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function records(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function names(entries: readonly Record<string, unknown>[], keys: readonly string[]): readonly string[] {
  return entries.flatMap((entry) => keys.map((key) => entry[key]).filter((name) => typeof name === "string"));
}

/** Parse a Custom Elements Manifest (schema 2.x) into per-tag vocabularies; undefined when no element is declared. */
function parseManifest(json: unknown): ComponentVocabulary | undefined {
  if (!isRecord(json)) return undefined;
  const vocabulary = new Map<string, ElementVocabulary>();
  for (const module of records(json.modules)) {
    for (const declaration of records(module.declarations)) {
      if (declaration.customElement !== true || typeof declaration.tagName !== "string") continue;
      const fields = records(declaration.members).filter(
        (member) => member.kind === "field" && member.static !== true && member.privacy === undefined,
      );
      const attributes = new Set(
        [...names(records(declaration.attributes), ["name", "fieldName"]), ...names(fields, ["name"])].flatMap(
          spellings,
        ),
      );
      const handlers = new Set(names(records(declaration.events), ["name"]).map((name) => `on${name.toLowerCase()}`));
      vocabulary.set(declaration.tagName, { attributes, handlers });
    }
  }
  return vocabulary.size > 0 ? vocabulary : undefined;
}

function load(file: string): ManifestLookup {
  const cached = loadedFiles.get(file);
  if (cached !== undefined) return cached;
  let lookup: ManifestLookup;
  try {
    const vocabulary = parseManifest(JSON.parse(readFileSync(file, "utf8")));
    lookup = vocabulary === undefined ? { kind: "unreadable", file } : { kind: "loaded", vocabulary };
  } catch {
    lookup = { kind: "unreadable", file };
  }
  loadedFiles.set(file, lookup);
  return lookup;
}

function manifestFromPackage(packageJson: string): string | undefined {
  try {
    const manifest = (JSON.parse(readFileSync(packageJson, "utf8")) as Record<string, unknown>).customElements;
    return typeof manifest === "string" ? path.resolve(path.dirname(packageJson), manifest) : undefined;
  } catch {
    return undefined;
  }
}

function discover(directory: string): string | undefined {
  if (discoveredFiles.has(directory)) return discoveredFiles.get(directory);
  const packageJson = path.join(directory, ...packageSegments);
  const parent = path.dirname(directory);
  const found = existsSync(packageJson)
    ? manifestFromPackage(packageJson)
    : parent === directory
      ? undefined
      : discover(parent);
  discoveredFiles.set(directory, found);
  return found;
}

/**
 * Locate the manifest for a linted file: an explicit path wins; otherwise the nearest installed
 * `@shopify/polaris-types` whose `package.json` declares a `customElements` file.
 */
export function lookupManifest(filename: string, cwd: string, manifestPath: string | undefined): ManifestLookup {
  if (manifestPath !== undefined) return load(path.resolve(cwd, manifestPath));
  const discovered = discover(path.dirname(path.resolve(cwd, filename)));
  return discovered === undefined ? absent : load(discovered);
}
