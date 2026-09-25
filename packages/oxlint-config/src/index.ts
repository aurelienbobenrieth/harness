import type { OxlintConfig } from "oxlint";

export type { OxlintConfig } from "oxlint";

type RuleEntries = NonNullable<OxlintConfig["rules"]>;
type OverrideEntry = NonNullable<OxlintConfig["overrides"]>[number];

function mergeList<T>(
  base: readonly T[] | null | undefined,
  overrides: readonly T[] | null | undefined,
  replace = false,
): T[] | undefined {
  const values = replace && overrides !== undefined ? [...(overrides ?? [])] : [...(base ?? []), ...(overrides ?? [])];

  return values.length ? Array.from(new Set(values)) : undefined;
}

/** File globs that receive the `vitest` plugin; source files never see `vitest/*` rules. */
export const testFileGlobs = ["**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];

/**
 * Test titles that name no behavior: a bare "works" / "should work", or the filler words "correctly",
 * "properly" and "as expected". One `mustNotMatch` string carries both checks because oxlint 1.82.0 ignores
 * `mustNotMatch` whenever `disallowedWords` is non-empty, and patterns written with `\b` or `\W` never match there,
 * hence the explicit `[^a-z]` word edges.
 */
export const vagueTestTitlePattern =
  "(?i)^(?:should )?works?$|(?:^|[^a-z])(?:correctly|properly|as expected)(?:[^a-z]|$)";

export const strictOxlintConfig = {
  categories: {
    correctness: "error",
    nursery: "off",
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
  plugins: ["eslint", "typescript", "unicorn", "oxc", "node", "promise"],
  rules: {
    "eslint/default-case": "off",
    "eslint/no-implied-eval": "off",
    "eslint/no-ternary": "off",
    "eslint/no-throw-literal": "off",
    "eslint/no-undefined": "off",
    "eslint/no-underscore-dangle": ["error", { allow: ["_tag", "_tree", "__dirname"] }],
    "eslint/no-warning-comments": "off",
    "eslint/one-var": ["error", "never"],
    "eslint/prefer-promise-reject-errors": "off",
    "eslint/require-await": "off",
    "node/no-top-level-await": "off",
    "oxc/no-async-await": "off",
    "oxc/no-optional-chaining": "off",
    "oxc/no-rest-spread-properties": "off",
    "typescript/ban-ts-comment": ["error", { "ts-ignore": true, "ts-expect-error": "allow-with-description" }],
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/no-unnecessary-condition": "error",
    "typescript/switch-exhaustiveness-check": [
      "error",
      { allowDefaultCaseForExhaustiveSwitch: false, requireDefaultForNonUnion: true },
    ],
    "unicorn/filename-case": ["error", { case: "kebabCase" }],
    "unicorn/prefer-array-find": "off",
    "unicorn/prefer-includes": "off",
    "unicorn/prefer-string-starts-ends-with": "off",
  },
  settings: {},
  overrides: [
    {
      files: testFileGlobs,
      plugins: ["vitest"],
      rules: {
        "vitest/no-importing-vitest-globals": "off",
        "vitest/no-standalone-expect": "off",
        "vitest/prefer-called-with": "error",
        "vitest/prefer-to-be-falsy": "off",
        "vitest/prefer-to-be-truthy": "off",
        "vitest/require-to-throw-message": "error",
        "vitest/valid-title": ["error", { mustNotMatch: vagueTestTitlePattern }],
      },
    },
  ],
} satisfies OxlintConfig;

/**
 * Low-noise nursery rules that are not part of the strict preset yet.
 * Spread into `rules` to trial them before they graduate.
 */
export const nurseryCandidateRules = {
  "eslint/no-unreachable-loop": "error",
  "eslint/no-useless-assignment": "error",
  "promise/no-return-in-finally": "error",
  "typescript/prefer-optional-chain": "error",
} satisfies RuleEntries;

export function defineStrictOxlintConfig(
  overrides: OxlintConfig = {},
  options: { readonly replaceLists?: boolean } = {},
): OxlintConfig {
  return structuredClone({
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
    ignorePatterns: mergeList(strictOxlintConfig.ignorePatterns, overrides.ignorePatterns, options.replaceLists),
    jsPlugins: mergeList(strictOxlintConfig.jsPlugins, overrides.jsPlugins, options.replaceLists),
    options: {
      ...strictOxlintConfig.options,
      ...overrides.options,
    },
    plugins: mergeList(strictOxlintConfig.plugins, overrides.plugins, options.replaceLists),
    rules: {
      ...strictOxlintConfig.rules,
      ...overrides.rules,
    },
    settings: {
      ...strictOxlintConfig.settings,
      ...overrides.settings,
    },
    overrides: mergeList<OverrideEntry>(strictOxlintConfig.overrides, overrides.overrides, options.replaceLists),
  });
}

/** Package specifier of the official TanStack Query lint plugin, loaded through oxlint `jsPlugins`. */
export const tanstackQueryPluginSpecifier = "@tanstack/eslint-plugin-query";

/**
 * Official TanStack Query rules that report under oxlint `jsPlugins`.
 * `no-void-query-fn` is absent on purpose: it needs the TypeScript checker, which oxlint does not
 * expose to JS plugins, so enabling it would enforce nothing.
 */
export const tanstackQueryRules = {
  "@tanstack/query/exhaustive-deps": "error",
  "@tanstack/query/infinite-query-property-order": "error",
  "@tanstack/query/mutation-property-order": "error",
  "@tanstack/query/no-rest-destructuring": "error",
  "@tanstack/query/no-unstable-deps": "error",
  "@tanstack/query/prefer-query-options": "error",
  "@tanstack/query/stable-query-client": "error",
} satisfies RuleEntries;

/** A JS plugin that joins the TanStack Query layer together with the rules it contributes. */
export interface TanstackQueryCompanionPlugin {
  readonly specifier: string;
  readonly rules: RuleEntries;
}

export interface TanstackQueryLayerOptions {
  /**
   * Extension point for plugins that complement the official one, such as the
   * `@aurelienbbn/oxlint-plugin-tanstack-query` package. Each entry is appended to `jsPlugins`
   * and its rules are merged after the official rules.
   */
  readonly companionPlugins?: readonly TanstackQueryCompanionPlugin[];
}

/**
 * Adds the opt-in TanStack Query layer to a lint config. The consumer installs
 * `@tanstack/eslint-plugin-query`; rules already set on the config win over the layer.
 */
export function withTanstackQueryLayer(
  config: OxlintConfig = defineStrictOxlintConfig(),
  options: TanstackQueryLayerOptions = {},
): OxlintConfig {
  const companionPlugins = options.companionPlugins ?? [];

  return structuredClone({
    ...config,
    jsPlugins: mergeList(config.jsPlugins, [
      tanstackQueryPluginSpecifier,
      ...companionPlugins.map((plugin) => plugin.specifier),
    ]),
    rules: {
      ...tanstackQueryRules,
      ...Object.assign({}, ...companionPlugins.map((plugin) => plugin.rules)),
      ...config.rules,
    },
  });
}

export interface LayerDirectionOptions {
  /** Globs of the layer being protected, such as every file under a `domain` folder. */
  readonly files: readonly string[];
  /** Import patterns the layer must not reach: gitignore-style globs for paths, bare names for packages. */
  readonly forbidden: readonly string[];
  /** Shown on every violation; state the allowed direction and the way out. */
  readonly message: string;
}

/**
 * Builds an `overrides` entry that forbids a declared layer from importing the listed modules through
 * `eslint/no-restricted-imports`. There is no default layer map: a project that declares no layers gets no rule.
 * oxlint replaces rule options instead of merging them, so give each file glob a single entry and list
 * every forbidden pattern of that layer in it.
 */
export function layerDirectionOverride(options: LayerDirectionOptions): OverrideEntry {
  return {
    files: [...options.files],
    rules: {
      "eslint/no-restricted-imports": [
        "error",
        { patterns: [{ group: [...options.forbidden], message: options.message }] },
      ],
    },
  };
}

/** Plugins oxlint loads when a config sets none; a config that sets `plugins` replaces them. */
const defaultOxlintPlugins: NonNullable<OxlintConfig["plugins"]> = ["eslint", "typescript", "unicorn", "oxc"];

/**
 * Every `import/*` rule of oxlint 1.82.0. Only the two import-graph rules are on; the rest are pinned off
 * because the strict preset enables whole categories, so loading the plugin would otherwise switch them all on.
 */
export const importGraphRules = {
  "import/consistent-type-specifier-style": "off",
  "import/default": "off",
  "import/export": "off",
  "import/exports-last": "off",
  "import/extensions": "off",
  "import/first": "off",
  "import/group-exports": "off",
  "import/max-dependencies": "off",
  "import/named": "off",
  "import/namespace": "off",
  "import/newline-after-import": "off",
  "import/no-absolute-path": "off",
  "import/no-amd": "off",
  "import/no-anonymous-default-export": "off",
  "import/no-commonjs": "off",
  "import/no-cycle": "error",
  "import/no-default-export": "off",
  "import/no-duplicates": "off",
  "import/no-dynamic-require": "off",
  "import/no-empty-named-blocks": "off",
  "import/no-mutable-exports": "off",
  "import/no-named-as-default": "off",
  "import/no-named-as-default-member": "off",
  "import/no-named-default": "off",
  "import/no-named-export": "off",
  "import/no-namespace": "off",
  "import/no-nodejs-modules": "off",
  "import/no-relative-parent-imports": "off",
  "import/no-self-import": "error",
  "import/no-unassigned-import": "off",
  "import/no-webpack-loader-syntax": "off",
  "import/prefer-default-export": "off",
  "import/unambiguous": "off",
} satisfies RuleEntries;

/**
 * Adds the opt-in import-graph layer: the `import` plugin with only `import/no-cycle` and
 * `import/no-self-import` enabled. Rules already set on the config win over the layer.
 */
export function withImportGraphLayer(config: OxlintConfig = defineStrictOxlintConfig()): OxlintConfig {
  return structuredClone({
    ...config,
    plugins: mergeList(config.plugins ?? defaultOxlintPlugins, ["import" as const]),
    rules: {
      ...importGraphRules,
      ...config.rules,
    },
  });
}

/** Native oxlint plugin name that `effect-tsgo patch --oxlint` registers in `oxlint-tsgolint`. */
export const effectTsgoPluginName = "effecttsgo";

/**
 * `@effect/tsgo` 0.45.0 diagnostics that its `recommended` preset leaves off, turned on because they own checks
 * Harness removed from `@aurelienbbn/oxlint-plugin-effect`: `no-unsafe-error-channel`, `matching-identifier`,
 * `no-effect-type-assertion`, and the closest (partial) owner of the two `Layer.provide` rules.
 */
export const effectTsgoOwnerRules = {
  "effecttsgo/any-unknown-in-error-context": "error",
  "effecttsgo/deterministic-keys": "error",
  "effecttsgo/strict-effect-provide": "error",
  "effecttsgo/unsafe-effect-type-assertion": "error",
} satisfies RuleEntries;

/**
 * `@effect/tsgo` 0.45.0 rewrites that point at code a `@aurelienbbn/oxlint-plugin-effect` rule reports, so the
 * suggested fix would trade one finding for another. The Harness rule owns each case.
 */
export const effectTsgoSettledRules = {
  "effecttsgo/catch-die-to-or-die": "off",
  "effecttsgo/catch-to-ignore": "off",
  "effecttsgo/catch-to-or-else-succeed": "off",
  "effecttsgo/redundant-or-die": "off",
} satisfies RuleEntries;

/**
 * Strict-preset rules that contradict an `@effect/tsgo` diagnostic or an idiom Effect's own API requires. The Effect
 * side wins; each rule keeps reporting what it exists for outside that idiom.
 *
 * - `typescript/promise-function-async`: its autofix adds `async`, which `effecttsgo/async-function` then reports.
 * - `eslint/new-cap`: Effect constructors are PascalCase functions (`Schema.Struct(…)`, `Context.Tag(…)`).
 *   `new lowercase()` still reports.
 * - `eslint/func-names`: `Effect.gen(function* () { … })` takes an anonymous generator. Other anonymous function
 *   expressions still report.
 * - `node/no-sync`: `Effect.runSync` runs an Effect at a runtime edge, not blocking I/O. `fs.*Sync` still reports.
 */
export const effectIdiomRules = {
  "eslint/func-names": ["error", "always", { generators: "never" }],
  "eslint/new-cap": ["error", { capIsNew: false }],
  "node/no-sync": ["error", { ignores: ["runSync"] }],
  "typescript/promise-function-async": "off",
} satisfies RuleEntries;

export interface EffectTsgoLayerOptions {
  /**
   * An oxlint preset exported by `@effect/tsgo/oxlint-presets`, usually `recommended`. The consumer installs
   * `@effect/tsgo` and imports the preset, so this package never pins the diagnostic list.
   */
  readonly preset: OxlintConfig;
}

/**
 * Adds the opt-in `@effect/tsgo` layer to a lint config: the given preset, the native `effecttsgo` plugin,
 * `effectTsgoOwnerRules`, `effectTsgoSettledRules`, and `effectIdiomRules`. The consumer installs `@effect/tsgo` and runs
 * `effect-tsgo patch --oxlint`; rules already set on the config win over the layer, and config options win over
 * the preset's options.
 *
 * @attribution https://github.com/Effect-TS/tsgo (MIT; oxlint preset shape, plugin name, and diagnostic names)
 */
export function withEffectTsgoLayer(config: OxlintConfig, options: EffectTsgoLayerOptions): OxlintConfig {
  const { preset } = options;
  // `effecttsgo` only exists once `effect-tsgo patch --oxlint` has run, so oxlint's plugin union omits it.
  const plugins = [...(preset.plugins ?? []), effectTsgoPluginName] as NonNullable<OxlintConfig["plugins"]>;

  return structuredClone({
    ...config,
    options: {
      ...preset.options,
      ...config.options,
    },
    plugins: mergeList(config.plugins ?? defaultOxlintPlugins, plugins),
    rules: {
      ...preset.rules,
      ...effectTsgoOwnerRules,
      ...effectTsgoSettledRules,
      ...effectIdiomRules,
      ...config.rules,
    },
  });
}
