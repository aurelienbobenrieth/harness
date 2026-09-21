/**
 * Resolves each tsconfig through its `extends` chain and fails when the effective compiler options are
 * looser than the strict baseline that type-aware lint rules assume.
 *
 * A loosened tsconfig is invisible to every AST rule: the input is JSON, and TypeScript never reports its
 * own permissiveness.
 */
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding, TsconfigStrictnessOptions } from "../finding.js";
import { fileExists, isDirectory, isRecord, listDirectory, parseJson, readTextFile } from "../fs-support.js";
import { workspacePackageJsonPaths } from "../workspace-support.js";

const docs = "https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-core#tsconfig-strictness";
const checkId = "tsconfig-strictness";

const strictFamilyFlags = [
  "alwaysStrict",
  "noImplicitAny",
  "noImplicitThis",
  "strictBindCallApply",
  "strictBuiltinIteratorReturn",
  "strictFunctionTypes",
  "strictNullChecks",
  "strictPropertyInitialization",
  "useUnknownInCatchVariables",
] as const;

const defaultRequiredFlags = [
  "strict",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "verbatimModuleSyntax",
  "erasableSyntaxOnly",
] as const;

const forbiddenFlags = ["ignoreDeprecations"] as const;

const tsconfigFilePattern = /^tsconfig(?:\.[\w-]+)*\.json$/;
const minReasonWords = 3;

type ResolvedOption = { readonly value: unknown; readonly source: string };

type ResolvedConfig = {
  readonly options: ReadonlyMap<string, ResolvedOption>;
  /** Absolute paths of every config reached through `extends`. */
  readonly bases: readonly string[];
};

class TsconfigResolutionError extends Error {}

/** Blanks comments and drops trailing commas while leaving string contents untouched. */
export function stripJsonc(text: string): string {
  const source = text.startsWith("\uFEFF") ? text.slice(1) : text;
  let withoutComments = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index] ?? "";
    const next = source[index + 1];
    if (char === '"') {
      const start = index;
      index += 1;
      while (index < source.length && source[index] !== '"') index += source[index] === "\\" ? 2 : 1;
      index += 1;
      withoutComments += source.slice(start, index);
    } else if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end < 0 ? source.length : end + 2;
      withoutComments += " ";
    } else {
      withoutComments += char;
      index += 1;
    }
  }

  let result = "";
  index = 0;
  while (index < withoutComments.length) {
    const char = withoutComments[index] ?? "";
    if (char === '"') {
      const start = index;
      index += 1;
      while (index < withoutComments.length && withoutComments[index] !== '"')
        index += withoutComments[index] === "\\" ? 2 : 1;
      index += 1;
      result += withoutComments.slice(start, index);
      continue;
    }
    if (char === "," && /^\s*[}\]]/.test(withoutComments.slice(index + 1))) {
      index += 1;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
}

async function firstExistingFile(candidates: readonly string[]): Promise<string | undefined> {
  for (const candidate of candidates) if (await fileExists(candidate)) return candidate;
  return undefined;
}

function splitPackageSpecifier(specifier: string): {
  readonly name: string;
  readonly subpath: string;
} {
  const segments = specifier.split("/");
  const nameLength = specifier.startsWith("@") ? 2 : 1;
  return {
    name: segments.slice(0, nameLength).join("/"),
    subpath: segments.slice(nameLength).join("/"),
  };
}

async function resolvePackageExtends(fromDirectory: string, specifier: string): Promise<string | undefined> {
  const { name, subpath } = splitPackageSpecifier(specifier);
  let directory = fromDirectory;
  for (;;) {
    const packageRoot = path.join(directory, "node_modules", name);
    if (await isDirectory(packageRoot)) {
      const manifest = parseJson(await readTextFile(path.join(packageRoot, "package.json")));
      const exported = isRecord(manifest) && isRecord(manifest["exports"]) ? manifest["exports"] : {};
      const exportTarget = exported[subpath === "" ? "." : `./${subpath}`];
      const target = path.join(packageRoot, subpath);
      const candidates = [
        ...(typeof exportTarget === "string" ? [path.join(packageRoot, exportTarget)] : []),
        target,
        `${target}.json`,
        ...(subpath === "" && isRecord(manifest) && typeof manifest["tsconfig"] === "string"
          ? [path.join(packageRoot, manifest["tsconfig"])]
          : []),
        path.join(target, "tsconfig.json"),
      ];
      const found = await firstExistingFile(candidates);
      if (found !== undefined) return found;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

async function resolveExtends(configPath: string, specifier: string): Promise<string | undefined> {
  const directory = path.dirname(configPath);
  if (specifier.startsWith("./") || specifier.startsWith("../") || path.isAbsolute(specifier)) {
    const target = path.resolve(directory, specifier);
    return firstExistingFile([target, `${target}.json`, path.join(target, "tsconfig.json")]);
  }
  return resolvePackageExtends(directory, specifier);
}

async function readConfig(configPath: string): Promise<Record<string, unknown>> {
  const text = await readTextFile(configPath);
  if (text === undefined) throw new TsconfigResolutionError(`${configPath} cannot be read`);
  const parsed = parseJson(stripJsonc(text));
  if (!isRecord(parsed)) throw new TsconfigResolutionError(`${configPath} is not a JSON object`);
  return parsed;
}

function extendsSpecifiers(config: Record<string, unknown>): readonly string[] {
  const value = config["extends"];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  return [];
}

async function resolveConfig(configPath: string, root: string, chain: readonly string[] = []): Promise<ResolvedConfig> {
  const normalized = path.resolve(configPath);
  if (chain.includes(normalized))
    throw new TsconfigResolutionError(`circular extends through ${displayPath(root, normalized)}`);
  const config = await readConfig(normalized);
  const options = new Map<string, ResolvedOption>();
  const bases: string[] = [];
  for (const specifier of extendsSpecifiers(config)) {
    const basePath = await resolveExtends(normalized, specifier);
    if (basePath === undefined)
      throw new TsconfigResolutionError(
        `extends "${specifier}" in ${displayPath(root, normalized)} does not resolve to a file`,
      );
    const base = await resolveConfig(basePath, root, [...chain, normalized]);
    bases.push(path.resolve(basePath), ...base.bases);
    for (const [name, option] of base.options) options.set(name, option);
  }
  const compilerOptions = config["compilerOptions"];
  if (isRecord(compilerOptions))
    for (const [name, value] of Object.entries(compilerOptions))
      options.set(name, { value, source: displayPath(root, normalized) });
  return { options, bases };
}

function displayPath(root: string, filePath: string): string {
  const relative = path.relative(root, filePath).replaceAll(path.sep, "/");
  return relative === "" || relative.startsWith("../") ? filePath.replaceAll(path.sep, "/") : relative;
}

async function isSolutionConfig(configPath: string): Promise<boolean> {
  try {
    const config = await readConfig(configPath);
    const files = config["files"];
    return Array.isArray(files) && files.length === 0 && config["include"] === undefined;
  } catch {
    return false;
  }
}

async function discoverConfigs(root: string): Promise<readonly string[]> {
  const directories = [root, ...(await workspacePackageJsonPaths(root)).map((manifest) => path.dirname(manifest))];
  const found: string[] = [];
  for (const directory of directories)
    for (const entry of await listDirectory(directory))
      if (tsconfigFilePattern.test(entry) && (await fileExists(path.join(directory, entry))))
        found.push(path.resolve(directory, entry));
  return [...new Set(found)].toSorted();
}

function validateOptions(options: TsconfigStrictnessOptions, requiredFlags: readonly string[]): void {
  const owned = new Set<string>([...requiredFlags, ...strictFamilyFlags, ...forbiddenFlags]);
  for (const [flag, reason] of Object.entries(options.waivers ?? {})) {
    if (!owned.has(flag)) throw new Error(`Unknown tsconfig-strictness waiver: ${flag}`);
    if (reason.trim().split(/\s+/).filter(Boolean).length < minReasonWords)
      throw new Error(`The tsconfig-strictness waiver for ${flag} needs a written reason of at least three words.`);
  }
}

function describe(option: ResolvedOption | undefined): string {
  return option === undefined ? "is unset" : `is ${JSON.stringify(option.value)} (set in ${option.source})`;
}

type Violation = { readonly flag: string; readonly message: string };

function violations(resolved: ResolvedConfig, requiredFlags: readonly string[]): readonly Violation[] {
  const found: Violation[] = [];
  for (const flag of requiredFlags) {
    const option = resolved.options.get(flag);
    if (option?.value !== true)
      found.push({
        flag,
        message: `\`${flag}\` ${describe(option)}; set it to true in compilerOptions.`,
      });
  }
  for (const flag of strictFamilyFlags) {
    const option = resolved.options.get(flag);
    if (option !== undefined && option.value !== true)
      found.push({
        flag,
        message: `\`${flag}\` ${describe(option)} and carves a hole in \`strict\`; delete the override.`,
      });
  }
  for (const flag of forbiddenFlags) {
    const option = resolved.options.get(flag);
    if (option !== undefined)
      found.push({
        flag,
        message: `\`${flag}\` ${describe(option)} and silences compiler deprecations; migrate the deprecated options and delete it.`,
      });
  }
  return found;
}

export const tsconfigStrictness: ConformanceCheck = {
  id: checkId,
  description: "Resolved tsconfig files keep the strict compiler baseline with no strict-family flag switched off.",
  docs,
  async run({ root, tsconfigStrictness: options }) {
    if (options === undefined) return [];
    const requiredFlags = [...new Set([...defaultRequiredFlags, ...(options.additionalRequiredFlags ?? [])])];
    validateOptions(options, requiredFlags);
    const waivers = options.waivers ?? {};
    const explicit = options.files !== undefined;
    const candidates = explicit
      ? (options.files ?? []).map((file) => path.resolve(root, file))
      : await discoverConfigs(root);

    const findings: ConformanceFinding[] = [];
    const resolvedConfigs = new Map<string, ResolvedConfig>();
    for (const configPath of candidates) {
      if (!explicit && (await isSolutionConfig(configPath))) continue;
      try {
        resolvedConfigs.set(configPath, await resolveConfig(configPath, root));
      } catch (error) {
        if (!(error instanceof TsconfigResolutionError)) throw error;
        findings.push({
          check: checkId,
          severity: "error",
          evaluation: "failed",
          message: `Compiler options cannot be resolved: ${error.message}. Fix the file or its extends target.`,
          path: displayPath(root, configPath),
          docs,
        });
      }
    }

    const extended = new Set([...resolvedConfigs.values()].flatMap((resolved) => resolved.bases));
    const checked = [...resolvedConfigs].filter(([configPath]) => explicit || !extended.has(configPath));
    if (checked.length === 0 && findings.length === 0)
      return [
        {
          check: checkId,
          severity: explicit ? "error" : "warning",
          evaluation: "unsupported",
          message:
            "No tsconfig file found; compiler strictness not evaluated. List the files in tsconfigStrictness.files.",
          docs,
        },
      ];

    const usedWaivers = new Set<string>();
    for (const [configPath, resolved] of checked) {
      const relativePath = displayPath(root, configPath);
      for (const violation of violations(resolved, requiredFlags)) {
        const reason = waivers[violation.flag];
        if (reason !== undefined) usedWaivers.add(violation.flag);
        findings.push({
          check: checkId,
          severity: reason === undefined ? "error" : "warning",
          message:
            reason === undefined
              ? `${relativePath}: ${violation.message}`
              : `${relativePath}: \`${violation.flag}\` is waived. Reason: ${reason.trim()}`,
          path: relativePath,
          docs,
        });
      }
    }
    for (const flag of Object.keys(waivers))
      if (!usedWaivers.has(flag))
        findings.push({
          check: checkId,
          severity: "warning",
          message: `The waiver for \`${flag}\` matches no checked tsconfig; delete the stale waiver.`,
          docs,
        });
    return findings;
  },
};
