# @aurelienbbn/conformance-core

[![npm](https://img.shields.io/npm/v/@aurelienbbn/conformance-core)](https://www.npmjs.com/package/@aurelienbbn/conformance-core) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/conformance-core)](https://www.npmjs.com/package/@aurelienbbn/conformance-core) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/conformance-core)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/conformance-core/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/conformance-core)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/conformance-core/package.json)

**5 repo-hygiene checks for any TypeScript repo. Plain functions or one Vitest file.**

```ts
// conformance.test.ts
import { coreConformance } from "@aurelienbbn/conformance-core/vitest";

coreConformance({ root: process.cwd(), tsconfigStrictness: {} });
```

`vitest` is an optional peer (`>=4.1.11 <6.0.0`); Node `^22.19.0 || ^24.11.0`.

## A report never confuses "no violations" with "no evidence"

```text
skipped      excluded by skipChecks · CSS probe or tsconfig gate unconfigured
unsupported  tool absent (jscpd, knip) · no tsconfig found
failed       timeout · bad report · throw · bad options   (tools cap at 120 s, Vitest tests at 125 s)
evaluated    ran to completion, can still hold violations

report.status   failed      any error finding or failed check
                incomplete  any check not evaluated
                passed      otherwise  (configured static checks, not whole-project compliance)
```

| Evaluation                                                                        | Vitest test                          |
| --------------------------------------------------------------------------------- | ------------------------------------ |
| skipped · unsupported warning                                                     | ⏭️ skipped, warning printed          |
| unsupported error (`requireTool`, `requireKnipConfig`, explicit tsconfig `files`) | ❌ fails                             |
| failed                                                                            | ❌ fails, even with warning severity |
| evaluated: errors · warnings only                                                 | ❌ fails · ✅ passes                 |

## Three entry points

```ts
import { runCoreConformance, runCoreConformanceReport } from "@aurelienbbn/conformance-core";

const findings = await runCoreConformance({ root: process.cwd(), skipChecks: ["duplication-budget"] }); // legacy, same severities
const report = await runCoreConformanceReport({ root: process.cwd() }); // { status, checks[], findings[] }
```

`coreConformance` (`/vitest`) makes one test per check. Finding: `check`, `severity`, `message`, `path?`, `docs` URL, `evaluation` when evidence is missing.

<details>
<summary>Full example, sample report, other exports</summary>

```ts
coreConformance({
  root: process.cwd(),
  duplication: { maxClones: 0 },
  deadExports: { requireKnipConfig: true },
  closedDesignSystem: {
    stylesheet: "theme.css",
    requiredSelectors: [".token"],
    forbiddenSelectors: [".raw"],
    buildCommand: [
      process.execPath,
      "-e",
      "require('node:fs').writeFileSync(process.argv[1], '.token {}')",
      "{output}",
    ],
  },
  tsconfigStrictness: {
    waivers: { exactOptionalPropertyTypes: "Vendor SDK typings assign undefined to optional fields." },
  },
});
```

`runCoreConformanceReport({ root, tsconfigStrictness: {}, skipChecks: ["duplication-budget"] })` on a workspace, trimmed:

```json
{
  "status": "failed",
  "checks": [
    { "check": "dependency-overlap", "status": "evaluated", "findings": [] },
    { "check": "duplication-budget", "status": "skipped", "reason": "Excluded by skipChecks.", "findings": [] },
    {
      "check": "closed-design-system-probe",
      "status": "skipped",
      "reason": "No CSS build/selector probe configured.",
      "findings": []
    },
    {
      "check": "tsconfig-strictness",
      "status": "evaluated",
      "findings": [
        {
          "check": "tsconfig-strictness",
          "severity": "error",
          "message": "packages/agentlint-plugin-core/tsconfig.json: `noUncheckedIndexedAccess` is unset; set it to true in compilerOptions.",
          "path": "packages/agentlint-plugin-core/tsconfig.json",
          "docs": "https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-core#tsconfig-strictness"
        }
      ]
    }
  ]
}
```

Also exported: `coreChecks`, `activeChecks`, and each check object (`dependencyOverlap`, `duplicationBudget`, `deadExports`, `closedDesignSystemProbe`, `tsconfigStrictness`).

</details>

## Checks

### dependency-overlap

**Built-in families warn (tools can be complementary); your `dependencyOverlapGroups` replace them and error; `[]` disables.** Each root and workspace `package.json` judged alone.

<details>
<summary>The 30 built-in families, workspace discovery</summary>

Reads `dependencies` + `devDependencies`. Workspaces: `pnpm-workspace.yaml` `packages:` literal paths and single-level `dir/*` only; negations and deeper globs ignored.

```text
dayjs date-fns moment luxon
axios got ky node-fetch superagent
uuid nanoid cuid cuid2 @paralleldrive/cuid2 ulid
zod yup joi ajv superstruct valibot arktype
lodash lodash-es ramda remeda es-toolkit
chalk picocolors kleur colorette ansis
dotenv dotenv-flow
jest vitest
winston pino bunyan loglevel consola
glob fast-glob globby tinyglobby
commander yargs cac citty meow
inquirer @inquirer/prompts prompts @clack/prompts enquirer
p-limit p-queue p-map promise-pool @supercharge/promise-pool
yaml js-yaml
papaparse csv-parse fast-csv
prisma drizzle-orm kysely knex typeorm sequelize
ws socket.io
immer mutative
zustand jotai valtio @xstate/store
fs-extra graceful-fs
semver compare-versions
marked markdown-it remark micromark
cheerio parse5 linkedom node-html-parser
execa zx tinyexec
rimraf del
cross-env env-cmd
nodemon tsx-watch watchexec
mime mime-types
deepmerge defu ts-deepmerge
query-string qs
```

</details>

### duplication-budget

[jscpd](https://github.com/kucherenko/jscpd), ignoring `node_modules`, `dist`, `coverage`, `.git`. Over budget: ❌ with the top 3 clones. **Malformed clone rows fail under any budget.**

### dead-exports

[knip](https://knip.dev) `--reporter json`: unused files, exports, types, namespace, enum, and class members (10 listed). Report shapes checked first. Default: no knip config still runs; absent knip warns; timeout or bad output fails.

### closed-design-system-probe

**A finite selector probe, not proof of exhaustive closure.** Exact required/forbidden selectors in your parsed build output. **No default builder, no implicit install**; the builder must include the probe inputs. Timeout, nonzero exit, no output, invalid CSS → failed.

> [!WARNING]
> Windows: pass a native executable or `node` plus the tool's JS entrypoint. Shell shims (`.cmd`, `.bat`, `npx`, `npm`, `pnpm`, `yarn`) are rejected.

<details>
<summary>Recipe: close a Tailwind v4 theme and prove it</summary>

1. Put `--*: initial` in the top-level `@theme` ([Tailwind theme docs](https://tailwindcss.com/docs/theme)) so only your tokens generate utilities, then migrate affected uses. Static utilities and arbitrary values still work: this closes the token set, not the class list.
2. Probe stylesheet: an isolated file importing the real one and requesting allowed and forbidden classes through `@source inline(...)` ([syntax](https://tailwindcss.com/docs/detecting-classes-in-source-files)). Without it, a missing selector may only mean "never discovered".
3. Build with the pinned local CLI as an executable plus argument array; never a downloaded floating CLI. `buildCommand` is required because core conformance has no framework default.
4. Wire it like [the example](https://github.com/aurelienbobenrieth/harness/blob/main/examples/conformance-core/closed-design-system-probe.example.ts).

For a full class allowlist, also check class construction and arbitrary values in source. A failed build or missing tool means unevaluated, never "forbidden absent". Keep probe candidates out of production source.

<!-- @attribution https://tailwindcss.com/docs/theme (inspiration from official documentation; independently written guidance) -->

</details>

### tsconfig-strictness

**A loosened tsconfig silently degrades type-aware lint (`no-unnecessary-condition`, `strict-boolean-expressions`, `no-unsafe-*`), and no AST rule sees JSON.** Checks effective options after `extends`; messages name the file that set each value.

Requires `strict: true` **written down, never inherited**; `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly` true; no strict-family flag off; no `ignoreDeprecations`, whatever its value.

<details>
<summary>Strict family, default files, waivers, failure modes, <code>extends</code> resolution</summary>

- Strict family: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `strictBuiltinIteratorReturn`, `noImplicitThis`, `useUnknownInCatchVariables`, `alwaysStrict`.
- `erasableSyntaxOnly` replaces a family of enum/namespace/parameter-property lint rules with a compiler guarantee.
- Default `files`: `tsconfig.json` + `tsconfig.*.json` in the root and every pnpm workspace package, minus solution files (`"files": []`, no `include`) and configs that only serve as another checked config's `extends` base.
- `additionalRequiredFlags`: more flags that must be `true`, e.g. `noImplicitOverride`.

| Input                                                        | Result                                             |
| ------------------------------------------------------------ | -------------------------------------------------- |
| waiver (flag → reason ≥ 3 words)                             | ⚠️ warning repeating the reason in every report    |
| waiver for a flag the check doesn't own, or reason < 3 words | throws (failed evaluation in the report)           |
| waiver matching nothing                                      | ⚠️ stale-waiver warning                            |
| missing or circular `extends`, unreadable or malformed file  | ❌ failed evaluation, never a pass                 |
| listed file missing                                          | ❌ failed                                          |
| no tsconfig discovered                                       | ⚠️ unsupported (❌ error when `files` is explicit) |

`extends` resolution: relative paths with or without `.json`; arrays, later entries winning; package specifiers from `node_modules` (scoped too) via string `exports` targets or the manifest `tsconfig` field; JSONC comments, trailing commas, a BOM. Reads JSON only: no `tsc` run, no TypeScript install needed.

</details>

## Options

| Option                                               | Default          | Notes                                                                                                         |
| ---------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `skipChecks`                                         | `[]`             | unknown IDs throw                                                                                             |
| `dependencyOverlapGroups`                            | 30 families      | yours replace them                                                                                            |
| `duplication.maxClones` · `.minLines` · `.minTokens` | `0` · `8` · `60` | safe integers; `maxClones` ≥ 0, others > 0                                                                    |
| `duplication.ignorePatterns`                         | `[]`             | generated/vendor globs                                                                                        |
| `duplication.requireTool`                            | `false`          | absent jscpd or bad run → ❌                                                                                  |
| `deadExports.requireKnipConfig`                      | `false`          | no config (`knip.json(c)`, `.knip.json(c)`, `knip(.config).ts/js`, `package.json#knip`), tool, or output → ❌ |
| `closedDesignSystem`                                 | unset (skipped)  | `stylesheet`, `buildCommand` argv with `{stylesheet}` `{output}`, `requiredSelectors`, `forbiddenSelectors`   |
| `tsconfigStrictness`                                 | unset (skipped)  | `{}` = defaults; `files`, `additionalRequiredFlags`, `waivers`                                                |

## Migration

- Unknown `skipChecks` IDs throw instead of silently losing the exception: fix the misspelling.
- Absent optional tools are skipped tests; bad output or failed runs fail. Both could pass as warning-only tests before.
- Duplication limits must be finite safe integers; malformed jscpd rows fail even under a generous budget.

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
