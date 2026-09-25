import type { OxfmtConfig } from "oxfmt";

export type { OxfmtConfig } from "oxfmt";

function mergeList<T>(
  base: readonly T[] | undefined,
  overrides: readonly T[] | undefined,
  replace = false,
): T[] | undefined {
  const values = replace && overrides !== undefined ? [...(overrides ?? [])] : [...(base ?? []), ...(overrides ?? [])];

  return values.length ? Array.from(new Set(values)) : undefined;
}

export const defaultOxfmtConfig = {
  printWidth: 120,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  tabWidth: 2,
  arrowParens: "always",
  jsdoc: {
    commentLineStrategy: "multiline",
  },
  sortPackageJson: true,
  ignorePatterns: [".agents/**", "**/*.wasm", "pnpm-lock.yaml"],
  overrides: [],
} satisfies OxfmtConfig;

export function defineOxfmtConfig(
  overrides: OxfmtConfig = {},
  options: { readonly replaceLists?: boolean } = {},
): OxfmtConfig {
  return structuredClone({
    ...defaultOxfmtConfig,
    ...overrides,
    ignorePatterns: mergeList(defaultOxfmtConfig.ignorePatterns, overrides.ignorePatterns, options.replaceLists),
    overrides: mergeList(defaultOxfmtConfig.overrides, overrides.overrides, options.replaceLists),
  });
}
