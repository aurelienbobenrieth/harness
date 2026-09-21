import type { OxfmtConfig } from "vite-plus/fmt";

export type VitePlusFormatConfig = OxfmtConfig;

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
  sortPackageJson: true,
  ignorePatterns: [".agents/**", "**/*.wasm", "pnpm-lock.yaml"],
  overrides: [],
} satisfies VitePlusFormatConfig;

export function defineOxfmtConfig(
  overrides: VitePlusFormatConfig = {},
  options: { readonly replaceLists?: boolean } = {},
): VitePlusFormatConfig {
  return structuredClone({
    ...defaultOxfmtConfig,
    ...overrides,
    ignorePatterns: mergeList(defaultOxfmtConfig.ignorePatterns, overrides.ignorePatterns, options.replaceLists),
    overrides: mergeList(defaultOxfmtConfig.overrides, overrides.overrides, options.replaceLists),
  });
}
