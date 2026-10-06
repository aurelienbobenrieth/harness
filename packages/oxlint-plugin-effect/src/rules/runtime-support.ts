export const defaultAllow = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/scripts/**"];

type RuleOptions = {
  readonly allow?: readonly string[];
};

export type RuleContextWithOptions = {
  readonly filename?: string;
  readonly getFilename?: () => string;
  readonly options?: readonly unknown[];
};

export function getFilename(context: RuleContextWithOptions): string {
  return context.filename ?? context.getFilename?.() ?? "";
}

export function getOptions(context: RuleContextWithOptions): RuleOptions {
  const candidate = context.options?.[0];
  if (typeof candidate !== "object" || candidate === null || !("allow" in candidate)) return {};

  const allow = (candidate as { readonly allow?: unknown }).allow;
  return Array.isArray(allow) && allow.every((entry) => typeof entry === "string") ? { allow } : {};
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob: string): RegExp {
  let pattern = "";
  const normalized = normalizePath(glob);

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized.charAt(index);
    const next = normalized.charAt(index + 1);
    const afterNext = normalized.charAt(index + 2);

    if (character === "*" && next === "*" && afterNext === "/") {
      pattern += "(?:.*/)?";
      index += 2;
      continue;
    }

    if (character === "*" && next === "*") {
      pattern += ".*";
      index += 1;
      continue;
    }

    if (character === "*") {
      pattern += "[^/]*";
      continue;
    }

    pattern += escapeRegExp(character);
  }

  return new RegExp(`^${pattern}$`, "u");
}

export function isAllowedFile(filename: string, patterns: readonly string[]): boolean {
  const normalized = normalizePath(filename);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

function stringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : undefined;
}

/**
 * Whether a rule scoped by a `files` option (the globs it checks) and an `allow` option (the globs it skips) checks
 * the current file.
 */
export function isScopedFile(
  context: RuleContextWithOptions,
  defaults: Readonly<{ files: readonly string[]; allow: readonly string[] }>,
): boolean {
  const candidate = context.options?.[0];
  const record = typeof candidate === "object" && candidate !== null ? (candidate as Record<string, unknown>) : {};
  const filename = getFilename(context);
  const files = stringArray(record.files) ?? defaults.files;
  const allow = stringArray(record.allow) ?? defaults.allow;
  return isAllowedFile(filename, files) && !isAllowedFile(filename, allow);
}
