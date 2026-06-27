import type { UserConfig } from "vite-plus";

export type VitePlusFormatConfig = NonNullable<UserConfig["fmt"]>;

function mergeList<T>(base: readonly T[] | undefined, overrides: readonly T[] | undefined): T[] | undefined {
  const values = [...(base ?? []), ...(overrides ?? [])];

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

export function defineOxfmtConfig(overrides: VitePlusFormatConfig = {}): VitePlusFormatConfig {
  return {
    ...defaultOxfmtConfig,
    ...overrides,
    ignorePatterns: mergeList(defaultOxfmtConfig.ignorePatterns, overrides.ignorePatterns),
    overrides: mergeList(defaultOxfmtConfig.overrides, overrides.overrides),
  };
}
