import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import {
  defineStrictOxlintConfig,
  effectTsgoOwnerRules,
  effectTsgoSettledRules,
  importGraphRules,
  layerDirectionOverride,
  nurseryCandidateRules,
  strictOxlintConfig,
  tanstackQueryPluginSpecifier,
  tanstackQueryRules,
  testFileGlobs,
  vagueTestTitlePattern,
  type OxlintConfig,
  withEffectTsgoLayer,
  withImportGraphLayer,
  withTanstackQueryLayer,
} from "./index.ts";

const execFileAsync = promisify(execFile);
const oxlintBin = path.resolve(import.meta.dirname, "..", "..", "..", "node_modules", "oxlint", "bin", "oxlint");

interface Diagnostic {
  readonly code: string;
  readonly filename: string;
  readonly line: number;
}

async function runOxlint(args: readonly string[], cwd: string): Promise<string> {
  try {
    return (await execFileAsync(process.execPath, [oxlintBin, ...args], { cwd })).stdout;
  } catch (error) {
    if (typeof error === "object" && error !== null && "stdout" in error) return String(error.stdout);
    throw error;
  }
}

/** Lints `files` in an OS temp directory with the installed oxlint; type-aware linting is off because no tsconfig exists there. */
async function lintWith(config: OxlintConfig, files: Readonly<Record<string, string>>): Promise<Diagnostic[]> {
  const directory = await mkdtemp(path.join(tmpdir(), "oxlint-config-"));
  try {
    const runnable = { ...config, options: { ...config.options, typeAware: false, typeCheck: false } };
    await writeFile(path.join(directory, "oxlint.json"), JSON.stringify(runnable));
    await Promise.all(
      Object.entries(files).map(async ([name, source]) => {
        await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
        await writeFile(path.join(directory, name), source);
      }),
    );
    const stdout = await runOxlint(["--config", "oxlint.json", "--format", "json", "."], directory);
    const output = JSON.parse(stdout) as {
      diagnostics: { code: string; filename: string; labels: { span: { line: number } }[] }[];
    };
    return output.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      filename: diagnostic.filename.replaceAll("\\", "/"),
      line: diagnostic.labels[0]?.span.line ?? 0,
    }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const strictPlugins = ["eslint", "typescript", "unicorn", "oxc", "node", "promise"];

/** Rule groups that demand opposite edits or report the same code twice; at most one member may stay on. */
const exclusiveRuleGroups: readonly (readonly string[])[] = [
  ["eslint/no-ternary", "unicorn/prefer-ternary"],
  ["node/no-top-level-await", "unicorn/prefer-top-level-await"],
  ["vitest/no-importing-vitest-globals", "vitest/prefer-importing-vitest-globals"],
  ["vitest/prefer-to-be-truthy", "vitest/prefer-strict-boolean-matchers"],
  ["vitest/prefer-to-be-falsy", "vitest/prefer-strict-boolean-matchers"],
  ["eslint/no-undefined", "unicorn/no-null"],
  ["eslint/default-case", "typescript/switch-exhaustiveness-check"],
  ["eslint/require-await", "typescript/require-await"],
  ["eslint/no-implied-eval", "typescript/no-implied-eval"],
  ["eslint/prefer-promise-reject-errors", "typescript/prefer-promise-reject-errors"],
  ["eslint/no-throw-literal", "typescript/only-throw-error"],
  ["unicorn/prefer-includes", "typescript/prefer-includes"],
  ["unicorn/prefer-string-starts-ends-with", "typescript/prefer-string-starts-ends-with"],
  ["unicorn/prefer-array-find", "typescript/prefer-find"],
];

const severityOf = (entry: unknown): unknown => (Array.isArray(entry) ? entry[0] : entry);

function isSwitchedOff(rule: string): boolean {
  const scopes: readonly Record<string, unknown>[] = [
    strictOxlintConfig.rules,
    ...strictOxlintConfig.overrides.map((override) => override.rules),
  ];

  return scopes.some((rules) => severityOf(rules[rule]) === "off");
}

it("merges overrides without duplicating list entries", () => {
  const config = defineStrictOxlintConfig({
    ignorePatterns: ["dist/**", "dist/**"],
    plugins: ["typescript", "import"],
    rules: {
      "typescript/no-explicit-any": "warn",
    },
  });

  expect(config.ignorePatterns).toEqual(["dist/**"]);
  expect(config.plugins).toEqual([...strictPlugins, "import"]);
  expect(config.rules?.["typescript/no-explicit-any"]).toBe("warn");
});

it("does not mutate the exported strict config", () => {
  defineStrictOxlintConfig({
    plugins: ["import"],
    rules: {
      "typescript/no-explicit-any": "warn",
    },
  });

  expect(strictOxlintConfig.plugins).toEqual(strictPlugins);
  expect(strictOxlintConfig.rules["typescript/no-explicit-any"]).toBe("error");
});

it("can remove default plugins and does not share nested rule options", () => {
  expect(defineStrictOxlintConfig({ plugins: ["typescript"] }, { replaceLists: true }).plugins).toEqual(["typescript"]);
  const config = defineStrictOxlintConfig();
  expect(config.rules?.["eslint/no-underscore-dangle"]).not.toBe(
    strictOxlintConfig.rules["eslint/no-underscore-dangle"],
  );
});

it("keeps every oxlint default plugin, because setting plugins replaces the defaults", () => {
  expect(strictOxlintConfig.plugins).toEqual(expect.arrayContaining(["eslint", "typescript", "unicorn", "oxc"]));
});

it("switches off the oxc rules that ban modern syntax", () => {
  for (const rule of ["oxc/no-async-await", "oxc/no-optional-chaining", "oxc/no-rest-spread-properties"]) {
    expect(strictOxlintConfig.rules).toHaveProperty([rule], "off");
  }
});

it("keeps independent const declarations independent", async () => {
  const separateDiagnostics = await lintWith(defineStrictOxlintConfig(), {
    "src/declarations.ts": "const first = 1;\nconst second = 2;\nexport const total = first + second;\n",
  });
  const joinedDiagnostics = await lintWith(defineStrictOxlintConfig(), {
    "src/declarations.ts": "const first = 1, second = 2;\nexport const total = first + second;\n",
  });

  expect(strictOxlintConfig.rules["eslint/one-var"]).toEqual(["error", "never"]);
  expect(separateDiagnostics.map((diagnostic) => diagnostic.code)).not.toContain("eslint(one-var)");
  expect(joinedDiagnostics.map((diagnostic) => diagnostic.code)).toContain("eslint(one-var)");
});

it.each(exclusiveRuleGroups)("never leaves %s and %s enabled together", (...group) => {
  expect(group.filter((rule) => !isSwitchedOff(rule)).length).toBeLessThanOrEqual(1);
});

it("keeps the typed rule of every typed/untyped duplicate", () => {
  const typedRules = exclusiveRuleGroups.flat().filter((rule) => rule.startsWith("typescript/"));

  expect(typedRules.filter(isSwitchedOff)).toEqual([]);
  expect(strictOxlintConfig.options.typeAware).toBe(true);
});

it("scopes the vitest plugin to test files", () => {
  expect(strictOxlintConfig.plugins).not.toContain("vitest");
  expect(strictOxlintConfig.overrides).toHaveLength(1);
  expect(strictOxlintConfig.overrides[0]).toMatchObject({ files: testFileGlobs, plugins: ["vitest"] });
  expect(Object.keys(strictOxlintConfig.rules).filter((rule) => rule.startsWith("vitest/"))).toEqual([]);
});

it("opts into no-unnecessary-condition while the nursery category stays off", () => {
  expect(strictOxlintConfig.categories.nursery).toBe("off");
  expect(strictOxlintConfig.rules["typescript/no-unnecessary-condition"]).toBe("error");
  expect(strictOxlintConfig.rules["typescript/switch-exhaustiveness-check"]).toEqual([
    "error",
    { allowDefaultCaseForExhaustiveSwitch: false, requireDefaultForNonUnion: true },
  ]);
  expect(Object.keys(strictOxlintConfig.rules)).not.toEqual(expect.arrayContaining(Object.keys(nurseryCandidateRules)));
});

it("adds the TanStack Query layer only on request", () => {
  expect(defineStrictOxlintConfig().jsPlugins).toBeUndefined();

  const config = withTanstackQueryLayer(
    defineStrictOxlintConfig({ rules: { "@tanstack/query/prefer-query-options": "off" } }),
  );

  expect(config.jsPlugins).toEqual([tanstackQueryPluginSpecifier]);
  expect(config.rules).toMatchObject({
    ...tanstackQueryRules,
    "@tanstack/query/prefer-query-options": "off",
  });
  expect(config.rules?.["typescript/no-explicit-any"]).toBe("error");
  expect(config.plugins).toEqual(strictPlugins);
});

it("leaves the inert no-void-query-fn rule out of the TanStack Query layer", () => {
  expect(Object.keys(tanstackQueryRules)).toHaveLength(7);
  expect(tanstackQueryRules).not.toHaveProperty(["@tanstack/query/no-void-query-fn"]);
});

it("appends companion plugins after the official TanStack Query plugin", () => {
  const config = withTanstackQueryLayer(defineStrictOxlintConfig({ jsPlugins: ["./local-plugin.js"] }), {
    companionPlugins: [{ specifier: "companion-plugin", rules: { "companion/some-rule": "error" } }],
  });

  expect(config.jsPlugins).toEqual(["./local-plugin.js", tanstackQueryPluginSpecifier, "companion-plugin"]);
  expect(config.rules).toMatchObject({ ...tanstackQueryRules, "companion/some-rule": "error" });
});

/** Same shape as `recommended` from `@effect/tsgo/oxlint-presets` 0.45.0, trimmed to the rules these tests touch. */
const effectTsgoPresetFixture = {
  options: { typeAware: true },
  plugins: ["effecttsgo"],
  rules: {
    "effecttsgo/catch-die-to-or-die": "warn",
    "effecttsgo/catch-to-ignore": "warn",
    "effecttsgo/floating-effect": "error",
    "effecttsgo/global-fetch": "warn",
  },
} as unknown as OxlintConfig;

it("adds the @effect/tsgo preset, its native plugin, the owner diagnostics, and the settled conflicts", () => {
  const config = withEffectTsgoLayer(defineStrictOxlintConfig(), { preset: effectTsgoPresetFixture });

  expect(config.plugins).toEqual([...strictPlugins, "effecttsgo"]);
  expect(config.rules).toMatchObject({
    "effecttsgo/floating-effect": "error",
    "effecttsgo/global-fetch": "warn",
    "effecttsgo/any-unknown-in-error-context": "error",
    "effecttsgo/deterministic-keys": "error",
    "effecttsgo/strict-effect-provide": "error",
    "effecttsgo/unsafe-effect-type-assertion": "error",
    "effecttsgo/catch-die-to-or-die": "off",
    "effecttsgo/catch-to-ignore": "off",
    "effecttsgo/catch-to-or-else-succeed": "off",
    "effecttsgo/redundant-or-die": "off",
    "typescript/no-explicit-any": "error",
  });
  expect(config.options).toMatchObject({ typeAware: true, denyWarnings: true });
});

it("pins the four off-by-default owner diagnostics and the four settled rewrites", () => {
  expect(effectTsgoOwnerRules).toEqual({
    "effecttsgo/any-unknown-in-error-context": "error",
    "effecttsgo/deterministic-keys": "error",
    "effecttsgo/strict-effect-provide": "error",
    "effecttsgo/unsafe-effect-type-assertion": "error",
  });
  expect(effectTsgoSettledRules).toEqual({
    "effecttsgo/catch-die-to-or-die": "off",
    "effecttsgo/catch-to-ignore": "off",
    "effecttsgo/catch-to-or-else-succeed": "off",
    "effecttsgo/redundant-or-die": "off",
  });
});

it("lets rules and options already on the config win over the @effect/tsgo layer", () => {
  const config = withEffectTsgoLayer(
    defineStrictOxlintConfig({
      options: { typeAware: false },
      rules: { "effecttsgo/catch-to-ignore": "warn", "effecttsgo/deterministic-keys": "off" },
    }),
    { preset: effectTsgoPresetFixture },
  );

  expect(config.rules?.["effecttsgo/catch-to-ignore"]).toBe("warn");
  expect(config.rules?.["effecttsgo/deterministic-keys"]).toBe("off");
  expect(config.options?.typeAware).toBe(false);
});

it("keeps oxlint's default plugins when the config sets none and leaves the preset untouched", () => {
  const presetBefore = structuredClone(effectTsgoPresetFixture);
  const config = withEffectTsgoLayer({}, { preset: effectTsgoPresetFixture });

  expect(config.plugins).toEqual(["eslint", "typescript", "unicorn", "oxc", "effecttsgo"]);
  expect(effectTsgoPresetFixture).toEqual(presetBefore);
});

it("pins the vitest rules that close assertion loopholes instead of relying on their category", () => {
  const [testOverride] = strictOxlintConfig.overrides;

  expect(testOverride.rules["vitest/require-to-throw-message"]).toBe("error");
  expect(testOverride.rules["vitest/prefer-called-with"]).toBe("error");
  expect(testOverride.rules["vitest/no-standalone-expect"]).toBe("off");
  expect(testOverride.rules["vitest/valid-title"]).toEqual(["error", { mustNotMatch: vagueTestTitlePattern }]);
});

it("allows assertions inside Effect-aware tests", async () => {
  const diagnostics = await lintWith(defineStrictOxlintConfig(), {
    "src/effect.test.ts": [
      'import { expect, it } from "@effect/vitest";',
      'import { Effect } from "effect";',
      'it.effect("checks a value", () => Effect.sync(() => expect(1).toBe(1)));',
    ].join("\n"),
  });

  expect(diagnostics.map((diagnostic) => diagnostic.code)).not.toContain("vitest(no-standalone-expect)");
});

it("configures valid-title with one mustNotMatch string, the only shape oxlint applies in full", () => {
  const [, options] = strictOxlintConfig.overrides[0].rules["vitest/valid-title"];

  expect(Object.keys(options)).toEqual(["mustNotMatch"]);
  expect(typeof options.mustNotMatch).toBe("string");
});

it("reports vague test titles, bare toThrow() and bare toHaveBeenCalled() under the installed oxlint", async () => {
  const titles = [
    "works",
    "should work",
    "Works",
    "adds items correctly",
    "renders as expected",
    "Properly: closes the cart",
    "rejects improperly signed tokens",
    "works offline",
    "adds an item to an empty cart",
  ];
  const source = [
    'import { expect, it } from "vitest";',
    'import { cart } from "./cart";',
    ...titles.map((title) => `it("${title}", () => { expect(cart.total()).toBe(30); });`),
    'it("rejects an empty cart", () => { expect(() => cart.pay()).toThrow(); });',
    'it("notifies the owner", () => { cart.pay(); expect(cart.notify).toHaveBeenCalled(); });',
  ].join("\n");

  const diagnostics = await lintWith(defineStrictOxlintConfig(), { "src/cart.test.ts": source });
  const linesOf = (code: string): number[] =>
    diagnostics.filter((diagnostic) => diagnostic.code === code).map((diagnostic) => diagnostic.line);

  expect(linesOf("vitest(valid-title)")).toEqual([3, 4, 5, 6, 7, 8]);
  expect(linesOf("vitest(require-to-throw-message)")).toEqual([12]);
  expect(linesOf("vitest(prefer-called-with)")).toEqual([13]);
});

it("builds a layer-direction override on eslint/no-restricted-imports", () => {
  const files = ["**/domain/**"];
  const forbidden = ["**/infra/**", "express"];
  const override = layerDirectionOverride({ files, forbidden, message: "Domain never imports infrastructure." });

  expect(override).toEqual({
    files,
    rules: {
      "eslint/no-restricted-imports": [
        "error",
        { patterns: [{ group: forbidden, message: "Domain never imports infrastructure." }] },
      ],
    },
  });
  expect(override.files).not.toBe(files);
  expect(JSON.stringify(strictOxlintConfig)).not.toContain("no-restricted-imports");
});

it("reports imports against the declared layer direction and leaves other layers alone", async () => {
  const config = defineStrictOxlintConfig({
    overrides: [
      layerDirectionOverride({
        files: ["**/domain/**"],
        forbidden: ["**/infra/**", "express"],
        message: "Domain never imports infrastructure.",
      }),
    ],
  });
  const reachesOut =
    'import express from "express";\nimport { db } from "../infra/db";\n\nexport const order = { db, express };\n';

  const diagnostics = await lintWith(config, {
    "src/domain/order.ts": reachesOut,
    "src/domain/tax.ts": 'import { rate } from "./rate";\n\nexport const tax = { rate };\n',
    "src/http/order.ts": reachesOut,
  });
  const restricted = diagnostics.filter((diagnostic) => diagnostic.code === "eslint(no-restricted-imports)");

  expect(restricted.map((diagnostic) => `${diagnostic.filename}:${diagnostic.line}`)).toEqual([
    "src/domain/order.ts:1",
    "src/domain/order.ts:2",
  ]);
});

it("adds the import-graph layer only on request, with two rules on and the rest pinned off", () => {
  expect(strictOxlintConfig.plugins).not.toContain("import");

  const config = withImportGraphLayer(defineStrictOxlintConfig({ rules: { "import/no-cycle": "warn" } }));
  const enabled = Object.entries(importGraphRules).filter(([, severity]) => severity !== "off");

  expect(config.plugins).toEqual([...strictPlugins, "import"]);
  expect(enabled).toEqual([
    ["import/no-cycle", "error"],
    ["import/no-self-import", "error"],
  ]);
  expect(config.rules).toMatchObject({ ...importGraphRules, "import/no-cycle": "warn" });
  expect(config.rules?.["typescript/no-explicit-any"]).toBe("error");
  expect(config.overrides).toEqual(defineStrictOxlintConfig().overrides);
});

it("keeps the oxlint default plugins when the import-graph layer wraps a config without a plugin list", () => {
  expect(withImportGraphLayer({ rules: {} }).plugins).toEqual(["eslint", "typescript", "unicorn", "oxc", "import"]);
});

it("pins every import rule the installed oxlint ships, so none arrives through a category", async () => {
  const rules = JSON.parse(await runOxlint(["--rules", "--format", "json"], import.meta.dirname)) as {
    scope: string;
    value: string;
  }[];
  const shipped = rules.filter((rule) => rule.scope === "import").map((rule) => `import/${rule.value}`);

  expect(shipped.length).toBeGreaterThan(0);
  expect(Object.keys(importGraphRules).toSorted()).toEqual(shipped.toSorted());
});

it("reports a two-file cycle and a self import, and stays silent on type-only cycles and every other import rule", async () => {
  const diagnostics = await lintWith(withImportGraphLayer(), {
    "src/order.ts":
      'import { tax } from "./tax";\n\nexport const total = (amount: number): number => amount + tax(amount);\n',
    "src/tax.ts": 'import { total } from "./order";\n\nexport const tax = (amount: number): number => total(amount);\n',
    "src/self.ts": 'import { self } from "./self";\n\nexport { self };\n',
    "src/plain.ts":
      'import * as path from "node:path";\nimport "./side-effect";\nimport settings from "./settings";\n\nexport default function plain(): string {\n  return path.join(String(settings), "a");\n}\nexport const other = require("./legacy");\n',
    "src/settings.ts": "export default { name: 1 };\n",
    "src/shape-a.ts": 'import type { B } from "./shape-b";\n\nexport interface A {\n  readonly b: B;\n}\n',
    "src/shape-b.ts": 'import type { A } from "./shape-a";\n\nexport interface B {\n  readonly a?: A;\n}\n',
    "src/side-effect.ts": "export {};\n",
  });
  const fromImportPlugin = diagnostics
    .filter((diagnostic) => diagnostic.code.startsWith("import("))
    .map((diagnostic) => `${diagnostic.filename} ${diagnostic.code}`)
    .toSorted();

  expect(fromImportPlugin).toEqual([
    "src/order.ts import(no-cycle)",
    "src/self.ts import(no-self-import)",
    "src/tax.ts import(no-cycle)",
  ]);
});
