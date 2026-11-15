/**
 * Pure boundary decisions between the units of one workspace member: no disk access, so every case is a plain unit
 * test.
 *
 * @module
 */
import path from "node:path";
import { matchesDirectory } from "../workspace-boundaries/boundaries.js";

/** A forbidden edge between source paths, e.g. features that never import hosting code. */
export type ForbiddenImport = {
  /** Path pattern of the importing file, relative to the source root. */
  readonly from: string;
  /** Path pattern of the imported file, relative to the source root. */
  readonly to: string;
  /** Why the edge is forbidden, appended to the report. */
  readonly message?: string;
};

/** The unit layout of one member's source root. */
export type UnitPolicy = {
  /** POSIX source root relative to the member, e.g. `src`; shown in front of every unit in a report. */
  readonly sourceRoot: string;
  /** Directory patterns of unit roots, relative to the source root. */
  readonly units: readonly string[];
  readonly forbidden: readonly ForbiddenImport[];
  /** Path patterns, relative to a unit root, that only the same unit may import. */
  readonly private: readonly string[];
};

/** One `#` subpath pattern of a member's package.json `imports` that maps onto its source root. */
export type SubpathAlias = {
  /** The key around its `*`, e.g. `#` and `` for `#*`. */
  readonly keyPrefix: string;
  readonly keySuffix: string;
  /** The target around its `*`, relative to the source root, e.g. `` and `` for `./src/*`. */
  readonly targetPrefix: string;
  readonly targetSuffix: string;
};

/** One import site, with paths relative to the source root. */
export type ImportSite = {
  readonly policy: UnitPolicy;
  readonly aliases: readonly SubpathAlias[];
  /** POSIX path of the importing file, relative to the source root. */
  readonly importer: string;
  readonly specifier: string;
  /** False exempts the site from `forbidden` and `private`, as for test files. */
  readonly judgeDependencies: boolean;
};

/** Why an import breaks a unit boundary, and the specifier that fixes it when one rewrite is safe. */
export type Violation = {
  readonly message: string;
  readonly replacement?: string;
};

function segmentsOf(file: string): readonly string[] {
  return file.split("/").filter((segment) => segment !== "" && segment !== ".");
}

/** The source root without `./` or slashes at either end; `` for the member root itself. */
export function normalizeSourceRoot(sourceRoot: string): string {
  return segmentsOf(sourceRoot.replaceAll("\\", "/")).join("/");
}

/** A file and every directory containing it, deepest first. */
function selfAndAncestors(file: string): readonly string[] {
  const segments = segmentsOf(file);
  return segments.map((_, index) => segments.slice(0, segments.length - index).join("/"));
}

/** True when a pattern matches the path or one of its directories: `*` within one segment, `**` across segments. */
function matchesPath(pattern: string, file: string): boolean {
  return selfAndAncestors(file).some((candidate) => matchesDirectory(pattern, candidate));
}

/** The deepest directory of a file that a unit pattern names, else the file's own directory. */
export function unitOf(units: readonly string[], file: string): string {
  const directories = selfAndAncestors(file).slice(1);
  return (
    directories.find((directory) => units.some((pattern) => matchesDirectory(pattern, directory))) ??
    directories[0] ??
    ""
  );
}

/**
 * The `#` subpath patterns of a package.json `imports` field whose string target lies inside the source root.
 * Exact keys and condition objects are skipped: they name single modules, not the source tree.
 */
export function aliasesFrom(importsField: unknown, sourceRoot: string): readonly SubpathAlias[] {
  if (typeof importsField !== "object" || importsField === null || Array.isArray(importsField)) return [];
  const root = normalizeSourceRoot(sourceRoot);

  return Object.entries(importsField).flatMap(([key, target]): readonly SubpathAlias[] => {
    if (!key.startsWith("#") || key.split("*").length !== 2 || typeof target !== "string") return [];
    if (!target.startsWith("./") || target.split("*").length !== 2) return [];
    const member = target.slice(2);
    if (root !== "" && !member.startsWith(`${root}/`)) return [];

    const inRoot = root === "" ? member : member.slice(root.length + 1);
    const [keyPrefix = "", keySuffix = ""] = key.split("*");
    const [targetPrefix = "", targetSuffix = ""] = inRoot.split("*");
    return [{ keyPrefix, keySuffix, targetPrefix, targetSuffix }];
  });
}

function isRelative(specifier: string): boolean {
  return specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../");
}

/** A specifier split before its `?query`, which every rewrite keeps. */
function splitQuery(specifier: string): { readonly bare: string; readonly query: string } {
  const index = specifier.indexOf("?");
  return index === -1
    ? { bare: specifier, query: "" }
    : { bare: specifier.slice(0, index), query: specifier.slice(index) };
}

/** A normalized source-root path, or `undefined` once it climbs out of the source root. */
function insideRoot(file: string): string | undefined {
  const normalized = path.posix.normalize(file);
  return normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)
    ? undefined
    : normalized;
}

/** Where a `#` specifier lands under Node's `imports` resolution: the longest key prefix wins. */
function resolveAlias(aliases: readonly SubpathAlias[], bare: string): string | undefined {
  const alias = aliases
    .filter(
      (candidate) =>
        bare.length > candidate.keyPrefix.length + candidate.keySuffix.length &&
        bare.startsWith(candidate.keyPrefix) &&
        bare.endsWith(candidate.keySuffix),
    )
    .toSorted((left, right) => right.keyPrefix.length - left.keyPrefix.length)[0];
  if (alias === undefined) return undefined;

  const middle = bare.slice(alias.keyPrefix.length, bare.length - alias.keySuffix.length);
  return insideRoot(`${alias.targetPrefix}${middle}${alias.targetSuffix}`);
}

/** The `#` specifier that resolves back to the target, or `undefined` when no alias reaches it unambiguously. */
function aliasFor(aliases: readonly SubpathAlias[], target: string): string | undefined {
  return aliases
    .filter(
      (alias) =>
        target.length > alias.targetPrefix.length + alias.targetSuffix.length &&
        target.startsWith(alias.targetPrefix) &&
        target.endsWith(alias.targetSuffix),
    )
    .map(
      (alias) =>
        `${alias.keyPrefix}${target.slice(alias.targetPrefix.length, target.length - alias.targetSuffix.length)}${alias.keySuffix}`,
    )
    .find((candidate) => resolveAlias(aliases, candidate) === target);
}

function relativeFor(importer: string, target: string): string {
  const relative = path.posix.relative(path.posix.dirname(importer), target);
  return relative.startsWith("../") ? relative : `./${relative}`;
}

function shown(policy: UnitPolicy, unit: string): string {
  return path.posix.join(policy.sourceRoot === "" ? "." : policy.sourceRoot, unit);
}

function dependencyViolation(
  site: ImportSite,
  target: string,
  units: { readonly from: string; readonly to: string },
): string | undefined {
  const { policy, importer, specifier } = site;
  const edge = policy.forbidden.find(
    (candidate) => matchesPath(candidate.from, importer) && matchesPath(candidate.to, target),
  );
  if (edge !== undefined) {
    const reason = edge.message ?? `files under "${edge.from}" never import files under "${edge.to}"`;
    return `${shown(policy, units.from)} must not import ${shown(policy, units.to)} ("${specifier}"): ${reason}. Move what both need where both may import it.`;
  }

  const inUnit = path.posix.relative(units.to, target);
  if (policy.private.some((pattern) => matchesPath(pattern, inUnit)))
    return `"${specifier}" reaches into ${inUnit}, private to ${shown(policy, units.to)}: import a module ${shown(policy, units.to)} exposes instead.`;
  return undefined;
}

/**
 * Why an import breaks a unit boundary inside one member, or `undefined` when it keeps them.
 *
 * Checks, in report order, for targets inside the source root: a forbidden edge; another unit's private path; a
 * relative path into another unit (fixed to its `#` subpath when an `imports` pattern reaches it); a `#` subpath back
 * into the importer's own unit (fixed to its relative path). Bare specifiers and targets outside the source root are
 * never judged. Imports within one unit skip `forbidden` and `private`.
 */
export function moduleViolation(site: ImportSite): Violation | undefined {
  const { policy, aliases, importer } = site;
  const { bare, query } = splitQuery(site.specifier);
  const relative = isRelative(bare);
  const target = relative
    ? insideRoot(path.posix.join(path.posix.dirname(importer), bare))
    : bare.startsWith("#")
      ? resolveAlias(aliases, bare)
      : undefined;
  if (target === undefined) return undefined;

  const units = { from: unitOf(policy.units, importer), to: unitOf(policy.units, target) };
  if (units.from !== units.to) {
    const dependency = site.judgeDependencies ? dependencyViolation(site, target, units) : undefined;
    if (dependency !== undefined) return { message: dependency };
    if (!relative) return undefined;

    const alias = aliasFor(aliases, target);
    return alias === undefined
      ? {
          message: `"${site.specifier}" leaves ${shown(policy, units.from)} for ${shown(policy, units.to)} by a relative path: map a "#" subpath import onto ${shown(policy, "")} in package.json and import through it.`,
        }
      : {
          message: `"${site.specifier}" leaves ${shown(policy, units.from)} for ${shown(policy, units.to)} by a relative path: import "${alias}${query}".`,
          replacement: `${alias}${query}`,
        };
  }

  if (relative) return undefined;
  const replacement = `${relativeFor(importer, target)}${query}`;
  return {
    message: `"${site.specifier}" stays inside ${shown(policy, units.from)}: import its relative path "${replacement}".`,
    replacement,
  };
}
