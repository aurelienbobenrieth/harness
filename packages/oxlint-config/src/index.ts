import type { UserConfig } from "vite-plus";

export type VitePlusLintConfig = NonNullable<UserConfig["lint"]>;

function mergeList<T>(base: readonly T[] | undefined, overrides: readonly T[] | undefined): T[] | undefined {
  const values = [...(base ?? []), ...(overrides ?? [])];

  return values.length ? Array.from(new Set(values)) : undefined;
}

export const strictOxlintConfig = {
  categories: {
    correctness: "error",
    nursery: "error",
    pedantic: "error",
    perf: "error",
    restriction: "error",
    style: "error",
    suspicious: "error",
  },
  env: {
    builtin: true,
    node: true,
  },
  ignorePatterns: [],
  jsPlugins: [],
  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: "error",
    typeAware: true,
    typeCheck: true,
  },
  plugins: ["eslint", "typescript", "unicorn", "vitest", "node", "promise"],
  rules: {
    "eslint/no-underscore-dangle": ["error", { allow: ["_tag", "_tree", "__dirname"] }],
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "unicorn/filename-case": ["error", { case: "kebabCase" }],
    "jest/no-conditional-expect": "off",
    "jest/valid-expect": "off",
    "jest/no-standalone-expect": "off",
    "jest/expect-expect": "off",
  },
  settings: {},
  overrides: [],
} satisfies VitePlusLintConfig;

export function defineStrictOxlintConfig(overrides: VitePlusLintConfig = {}): VitePlusLintConfig {
  return {
    ...strictOxlintConfig,
    ...overrides,
    categories: {
      ...strictOxlintConfig.categories,
      ...overrides.categories,
    },
    env: {
      ...strictOxlintConfig.env,
      ...overrides.env,
    },
    ignorePatterns: mergeList(strictOxlintConfig.ignorePatterns, overrides.ignorePatterns),
    jsPlugins: mergeList(strictOxlintConfig.jsPlugins, overrides.jsPlugins),
    options: {
      ...strictOxlintConfig.options,
      ...overrides.options,
    },
    plugins: mergeList(strictOxlintConfig.plugins, overrides.plugins),
    rules: {
      ...strictOxlintConfig.rules,
      ...overrides.rules,
    },
    settings: {
      ...strictOxlintConfig.settings,
      ...overrides.settings,
    },
    overrides: mergeList(strictOxlintConfig.overrides, overrides.overrides),
  };
}
