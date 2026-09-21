# @aurelienbbn/conformance-core

Stack-agnostic repo hygiene conformance checks: the slop that accumulates in any codebase regardless of framework — duplicate dependencies, copy-pasted blocks, dead exports, and leaky design-system builds. Ships as plain check functions plus a Vitest adapter.

## Checks

### dependency-overlap

Reads the root and discovered workspace manifests, evaluating overlap within each manifest. Built-in families produce advisory warnings because tools can be complementary; explicit `dependencyOverlapGroups` replace those defaults and produce errors for the consumer's declared interchangeable dependencies. An empty list disables family advice. See `defaultGroups` in the source for the exact inventory.

### duplication-budget

Runs [jscpd](https://github.com/kucherenko/jscpd) when it is installed and fails once the clone count exceeds `duplication.maxClones` (default 0, with `minLines` 8 / `minTokens` 60). node_modules, dist, coverage, and .git are ignored. An absent optional jscpd produces an unsupported warning and a skipped Vitest test. Set `duplication.requireTool: true` when missing tooling must fail.

### dead-exports

Runs [knip](https://knip.dev) with the JSON reporter and reports unused files and exports. Missing optional tooling produces a warning. `deadExports.requireKnipConfig: true` requires both configuration and a working tool; missing or malformed evidence produces an error. Report objects and supported issue arrays are shape-checked before interpretation.

### closed-design-system-probe

Only runs when `closedDesignSystem` is configured. Supply an explicit native `buildCommand` with `{stylesheet}` and `{output}` placeholders. The probe parses built CSS and compares exact required/forbidden selector lists; it does not establish exhaustive closure. There is no default builder and no implicit package installation.

### tsconfig-strictness

Only runs when `tsconfigStrictness` is set; `{}` enables the defaults. Each checked tsconfig is resolved through its whole `extends` chain (relative paths with or without `.json`, arrays with later entries winning, package specifiers looked up in `node_modules` including scoped names, string `exports` targets and the manifest `tsconfig` field; JSONC comments, trailing commas and a BOM are accepted). The effective `compilerOptions` must then satisfy:

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and `erasableSyntaxOnly` resolve to `true`. `strict` must be written down: an inherited compiler default is not evidence.
- No strict-family flag (`strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `strictBuiltinIteratorReturn`, `noImplicitThis`, `useUnknownInCatchVariables`, `alwaysStrict`) is switched off underneath `strict`.
- `ignoreDeprecations` is absent, whatever its value.

Each message names the file that set the offending value. Options:

- `files`: root-relative tsconfig paths. Default: `tsconfig.json` and `tsconfig.*.json` in the root and every pnpm workspace package, minus solution files (`"files": []` without `include`) and configs that only serve as the `extends` base of another checked config.
- `additionalRequiredFlags`: more flags that must be `true`, for example `noImplicitOverride` or `noFallthroughCasesInSwitch`.
- `waivers`: flag name to written reason (at least three words). A waived flag becomes a warning that repeats the reason, so the exception stays visible in every report. A waiver for a flag the check does not own throws; a waiver that matches nothing is reported as stale.

A missing or circular `extends`, an unreadable or malformed file, and a listed file that does not exist are failed evaluations, never a pass. No discovered tsconfig is unsupported evidence. The check reads JSON only: it neither runs `tsc` nor needs TypeScript installed.

Why a conformance check: type-aware lint rules (`no-unnecessary-condition`, `strict-boolean-expressions`, `no-unsafe-*`) silently degrade under a loosened tsconfig, loosening it is the cheapest way to make errors disappear, and no AST rule sees a JSON config. `erasableSyntaxOnly` also replaces a family of enum/namespace/parameter-property lint rules with a compiler guarantee.

Findings carry severity (`error`/`warning`) and a docs URL. The legacy finding API preserves those severities. The Vitest adapter prints warnings, skips unavailable optional evidence, and fails error findings or failed evaluations even when their finding severity is a warning. Evaluated advisory findings still pass. Tool runs are capped at 120 seconds. The report API below exposes the complete evaluation inventory for automation.

## Vitest usage

```ts
// conformance.test.ts
import { coreConformance } from "@aurelienbbn/conformance-core/vitest";

coreConformance({
  root: process.cwd(),
  duplication: { maxClones: 0 },
  deadExports: { requireKnipConfig: true },
  closedDesignSystem: {
    stylesheet: "frontend/theme.css",
    buildCommand: [process.execPath, "scripts/build-css.mjs", "{stylesheet}", "{output}"],
    requiredSelectors: [".btn", ".card"],
    forbiddenSelectors: [".mt-4", ".text-red-500"],
  },
  tsconfigStrictness: {
    waivers: { exactOptionalPropertyTypes: "Vendor SDK typings assign undefined to optional fields." },
  },
});
```

## Programmatic usage

```ts
import { runCoreConformance } from "@aurelienbbn/conformance-core";

const findings = await runCoreConformance({
  root: process.cwd(),
  skipChecks: ["duplication-budget"],
});
```

```ts
import { runCoreConformanceReport } from "@aurelienbbn/conformance-core";

const report = await runCoreConformanceReport({ root: process.cwd() });
// report.status: passed | incomplete | failed
// report.checks: one entry per check, with status, reason, and findings
```

Each check is `evaluated`, `skipped`, `unsupported`, or `failed`. An evaluated check can still have violations. Explicit exclusions, an unconfigured CSS probe and an unconfigured tsconfig gate are skipped; absent tools are unsupported; timeouts, invalid reports, and execution exceptions are failed evaluations. Only complete evaluation without error findings yields `passed`; optional missing evidence yields `incomplete`. These statuses describe the configured static checks, not whole-project compliance.

Migration: unknown `skipChecks` IDs now throw, so correct misspellings rather than silently losing the intended exception. Vitest lists explicit exclusions and the unconfigured CSS probe as skipped tests. Duplication limits must be finite safe integers (`minLines`/`minTokens` positive, `maxClones` nonnegative). Malformed report rows are rejected even when a generous budget would otherwise hide them.

## Contract boundaries and migration

Required Knip gates (`deadExports.requireKnipConfig: true`) fail on missing configuration/tooling or unusable output. Set `duplication.requireTool: true` for the same required-tool behavior in jscpd; `duplication.ignorePatterns` adds generated/vendor exclusions. Migration: unavailable optional tools now register as skipped Vitest tests; malformed output and failed execution fail the test. They previously could appear as passing warning-only tests. This makes the adapter agree with the report's evidence status.

Dependency overlap is evaluated within each manifest. Built-in groups are advisory; explicitly supplied equivalence groups are enforced. The CSS probe requires an explicit `buildCommand` and matches exact parsed selectors. It checks finite required/forbidden lists, not exhaustive closure. Your builder must include the probe inputs. On Windows use a native executable or `node` plus the installed tool's JavaScript entrypoint; shell shims are rejected. Tool adapters have a 120-second execution limit and the Vitest wrapper allows 125 seconds.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                   | Trigger or review scope                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `closed-design-system-probe` | The built CSS contains every owned token utility and excludes configured forbidden selectors.      |
| `dead-exports`               | No unused files or exports remain in the codebase (knip).                                          |
| `dependency-overlap`         | Only one package per known-duplicate dependency family may be installed.                           |
| `duplication-budget`         | Copy-pasted blocks stay within the configured clone budget (jscpd).                                |
| `tsconfig-strictness`        | Resolved tsconfig files keep the strict compiler baseline with no strict-family flag switched off. |

### Credited concepts

- ai-automation by Sandro Maglione (inspiration, independently re-implemented)
- code-slop by asyrafhussin (MIT, concept re-implemented)
- desloppify by Peter O'Malley (concept only, no code reuse)

<!-- harness-catalog:end -->
