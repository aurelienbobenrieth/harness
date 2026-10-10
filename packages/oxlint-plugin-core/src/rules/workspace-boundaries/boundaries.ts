/**
 * Pure boundary decisions between workspace members: no disk access, so every case is a plain unit test.
 *
 * @module
 */

/** `app` members are deployables nothing else may import; `package` members are libraries. */
type MemberKind = "app" | "package";

/** One `exports` key of a member manifest, and whether it opens the subpath or closes it with `null`. */
export type ExportKey = {
  readonly key: string;
  readonly open: boolean;
};

/** One workspace member, as the rule sees it. */
export type Member = {
  /** Workspace-relative POSIX directory, e.g. `packages/ui`. */
  readonly dir: string;
  readonly name: string;
  readonly kind: MemberKind;
  /** The `exports` keys of its manifest; a manifest without subpath keys opens only `.`. */
  readonly exports: readonly ExportKey[];
};

/** A forbidden edge between member directories, e.g. vertical packages that never import each other. */
export type ForbiddenImport = {
  /** Directory pattern of the importing member: `*` matches within one segment, `**` any number of segments. */
  readonly from: string;
  /** Directory pattern of the imported member. */
  readonly to: string;
  /** Why the edge is forbidden, appended to the report. */
  readonly message?: string;
};

/** One import site: who imports, what, and the workspace it is judged against. */
export type ImportSite = {
  readonly members: readonly Member[];
  /** Workspace-relative POSIX path of the importing file. */
  readonly importer: string;
  readonly specifier: string;
  readonly forbidden?: readonly ForbiddenImport[];
};

const bareSpecifier = /^(?<name>@[^/]+\/[^/]+|[^@/.][^/]*)(?<rest>\/.*)?$/u;

function segmentMatches(pattern: string, segment: string): boolean {
  const source = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*");
  return new RegExp(`^${source}$`, "u").test(segment);
}

function segmentsMatch(pattern: readonly string[], directory: readonly string[]): boolean {
  const [head, ...rest] = pattern;
  if (head === undefined) return directory.length === 0;
  if (head === "**")
    return segmentsMatch(rest, directory) || (directory.length > 0 && segmentsMatch(pattern, directory.slice(1)));
  const [segment, ...remaining] = directory;
  return segment !== undefined && segmentMatches(head, segment) && segmentsMatch(rest, remaining);
}

function segmentsOf(path: string): readonly string[] {
  return path.split("/").filter((segment) => segment !== "" && segment !== ".");
}

/**
 * True when a workspace-relative directory matches a directory pattern such as `packages/features/*`: `*` matches
 * within one segment, a whole `**` segment matches zero or more segments.
 */
export function matchesDirectory(pattern: string, directory: string): boolean {
  return segmentsMatch(segmentsOf(pattern), segmentsOf(directory));
}

/** Subpath key matching per Node's `exports` resolution: an exact key wins, else the longest `*` pattern prefix. */
function exportKeyFor(exports: readonly ExportKey[], subpath: string): ExportKey | undefined {
  const exact = exports.find((entry) => entry.key === subpath);
  if (exact !== undefined) return exact;

  return exports
    .filter((entry) => {
      const star = entry.key.indexOf("*");
      if (star === -1) return false;
      const prefix = entry.key.slice(0, star);
      const suffix = entry.key.slice(star + 1);
      return subpath.length >= prefix.length + suffix.length && subpath.startsWith(prefix) && subpath.endsWith(suffix);
    })
    .toSorted((left, right) => right.key.indexOf("*") - left.key.indexOf("*"))[0];
}

/** The member owning a file; the deepest member wins when members nest. */
function memberAt(members: readonly Member[], file: string): Member | undefined {
  return members
    .filter((member) => file === member.dir || file.startsWith(`${member.dir}/`))
    .toSorted((left, right) => right.dir.length - left.dir.length)[0];
}

function isRelative(specifier: string): boolean {
  return specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../");
}

/** Workspace-relative path a relative specifier points at; `..` stops at the workspace root. */
function resolveRelative(importer: string, specifier: string): string {
  return decodeURIComponent(new URL(specifier, `file:///${importer}`).pathname).replace(/^\//u, "");
}

function forbiddenViolation(
  forbidden: readonly ForbiddenImport[],
  from: Member,
  to: Member,
  specifier: string,
): string | undefined {
  const edge = forbidden.find(
    (candidate) => matchesDirectory(candidate.from, from.dir) && matchesDirectory(candidate.to, to.dir),
  );
  if (edge === undefined) return undefined;

  const reason = edge.message ?? `members under "${edge.from}" never import members under "${edge.to}"`;
  return `${from.name} must not import ${to.name} ("${specifier}"): ${reason}.`;
}

function exportsViolation(to: Member, specifier: string): string | undefined {
  const rest = bareSpecifier.exec(specifier)?.groups?.["rest"];
  const subpath = rest === undefined ? "." : `.${rest}`;
  if (exportKeyFor(to.exports, subpath)?.open === true) return undefined;

  return `"${specifier}" is not opened by the package.json exports of ${to.name}: import one of its exports, or export this subpath from ${to.name}.`;
}

/**
 * Why an import crosses a workspace boundary, or `undefined` when it stays inside one.
 *
 * Boundaries, in report order: a forbidden edge of the matrix; a package never imports an app; members never reach
 * each other by relative path; a member enters another only through a subpath its `exports` open. Files outside every
 * member (root configs, scripts) and imports within one member are never judged.
 */
export function boundaryViolation(site: ImportSite): string | undefined {
  const { members, importer, specifier } = site;
  const from = memberAt(members, importer);
  if (from === undefined) return undefined;

  const relative = isRelative(specifier);
  const to = relative
    ? memberAt(members, resolveRelative(importer, specifier))
    : members.find((member) => member.name === bareSpecifier.exec(specifier)?.groups?.["name"]);
  if (to === undefined || to.dir === from.dir) return undefined;

  const forbidden = forbiddenViolation(site.forbidden ?? [], from, to, specifier);
  if (forbidden !== undefined) return forbidden;
  if (from.kind === "package" && to.kind === "app")
    return `Packages never import apps: ${from.name} imports ${to.name} ("${specifier}"). Move the shared code into a package both can import.`;
  if (relative)
    return `${from.name} reaches into ${to.name} by a relative path: import "${to.name}" through its package.json exports.`;
  return exportsViolation(to, specifier);
}
