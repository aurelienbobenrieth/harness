import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parse, ParseErrorCode, type ParseError } from "jsonc-parser";
import type { ConformanceFinding, ConformanceRunOptions } from "./finding.js";

/** Wrangler's own lookup order when no `--config` is given. */
const lookupOrder = ["wrangler.json", "wrangler.jsonc", "wrangler.toml"] as const;

type JsonObject = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One deployable Worker: the top-level config or one named environment inside it. */
export type WranglerTarget = {
  /** `top level` or `env.<name>`. */
  readonly label: string;
  /** The keys written for this target. Environments hold only their own keys, never inherited ones. */
  readonly own: JsonObject;
};

export type WranglerConfig = {
  /** Project-relative, forward slashes. */
  readonly path: string;
  readonly directory: string;
  readonly top: JsonObject;
  readonly environments: readonly WranglerTarget[];
};

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function toProjectPath(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join("/");
}

/**
 * Resolves the configuration files under review. Explicit selections outside the project or empty lists
 * are caller errors and throw; an absent file is reported as missing evidence.
 */
export async function selectWranglerConfigs(
  options: ConformanceRunOptions,
  check: string,
  docs: string,
): Promise<{ readonly paths: readonly string[]; readonly findings: readonly ConformanceFinding[] }> {
  const root = path.resolve(options.root);
  if (options.wranglerConfigs === undefined) {
    for (const name of lookupOrder) if (await isFile(path.join(root, name))) return { paths: [name], findings: [] };
    return {
      paths: [],
      findings: [
        {
          check,
          docs,
          severity: "error",
          evaluation: "failed",
          message:
            "No wrangler.json, wrangler.jsonc, or wrangler.toml at the project root. Set `wranglerConfigs` to each Worker's config.",
        },
      ],
    };
  }
  if (options.wranglerConfigs.length === 0) throw new Error("wranglerConfigs must list at least one file.");
  const paths: string[] = [];
  const findings: ConformanceFinding[] = [];
  for (const entry of options.wranglerConfigs) {
    const absolute = path.resolve(root, entry);
    const relative = toProjectPath(root, absolute);
    if (entry.trim() === "" || path.isAbsolute(entry) || relative.startsWith("..") || relative === "")
      throw new Error(`wranglerConfigs entry must be a file inside the project: ${JSON.stringify(entry)}`);
    if (await isFile(absolute)) paths.push(relative);
    else
      findings.push({
        check,
        docs,
        path: relative,
        severity: "error",
        evaluation: "failed",
        message: `${relative} does not exist. Fix the wranglerConfigs entry.`,
      });
  }
  return { paths, findings };
}

function parseEnvironments(top: JsonObject): readonly WranglerTarget[] | undefined {
  const env = top["env"];
  if (env === undefined) return [];
  if (!isRecord(env)) return undefined;
  const targets: WranglerTarget[] = [];
  for (const [name, own] of Object.entries(env)) {
    if (!isRecord(own)) return undefined;
    targets.push({ label: `env.${name}`, own });
  }
  return targets;
}

/**
 * Reads every selected JSON/JSONC configuration. TOML is reported as unsupported evidence: this package
 * carries no TOML parser, and Cloudflare recommends JSON configuration for new projects.
 */
export async function loadWranglerConfigs(
  options: ConformanceRunOptions,
  check: string,
  docs: string,
): Promise<{ readonly configs: readonly WranglerConfig[]; readonly findings: readonly ConformanceFinding[] }> {
  const selection = await selectWranglerConfigs(options, check, docs);
  const findings = [...selection.findings];
  const configs: WranglerConfig[] = [];
  const root = path.resolve(options.root);
  for (const relative of selection.paths) {
    if (relative.endsWith(".toml")) {
      findings.push({
        check,
        docs,
        path: relative,
        severity: "warning",
        evaluation: "unsupported",
        message: `${relative} was not evaluated: only wrangler.json and wrangler.jsonc are read. Migrate to wrangler.jsonc, the format Cloudflare recommends.`,
      });
      continue;
    }
    const absolute = path.join(root, relative);
    const errors: ParseError[] = [];
    let parsed: unknown;
    try {
      parsed = parse(await readFile(absolute, "utf8"), errors, { allowTrailingComma: true });
    } catch {
      errors.push({ error: ParseErrorCode.InvalidSymbol, offset: 0, length: 0 });
    }
    const environments = isRecord(parsed) ? parseEnvironments(parsed) : undefined;
    if (errors.length > 0 || !isRecord(parsed) || environments === undefined) {
      findings.push({
        check,
        docs,
        path: relative,
        severity: "error",
        evaluation: "failed",
        message: `${relative} is unreadable, invalid JSONC, or has a non-object \`env\` entry. Fix it so Wrangler and this check can read it.`,
      });
      continue;
    }
    configs.push({ path: relative, directory: path.dirname(absolute), top: parsed, environments });
  }
  return { configs, findings };
}

/**
 * Environments that override an inheritable key. An environment that omits it runs with the top-level
 * value, which the top-level evaluation already covers.
 */
export function overridingEnvironments(config: WranglerConfig, keys: readonly string[]): readonly WranglerTarget[] {
  return config.environments.filter((target) => keys.some((key) => target.own[key] !== undefined));
}

/** Inheritable keys resolve to the environment's own value, else the top-level one. */
export function inherited(config: WranglerConfig, target: WranglerTarget, key: string): unknown {
  return target.own[key] ?? config.top[key];
}
