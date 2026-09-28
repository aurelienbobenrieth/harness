# @aurelienbbn/conformance-alchemy

[![npm](https://img.shields.io/npm/v/@aurelienbbn/conformance-alchemy)](https://www.npmjs.com/package/@aurelienbbn/conformance-alchemy) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/conformance-alchemy)](https://www.npmjs.com/package/@aurelienbbn/conformance-alchemy) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/conformance-alchemy)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/conformance-alchemy/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/conformance-alchemy)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/conformance-alchemy/package.json)

**4 checks that catch Alchemy v2 setups that deploy fine once and then lose track of your infrastructure: state committed to git, CI deploys on local state, PR previews nobody destroys, and a floating beta version.**

```text
 alchemy.run.ts ────┐
 .gitignore + git ──┼─▶ alchemyChecks (4) ─▶ report { passed | incomplete | failed }   Vitest or plain function
 .github/workflows ─┤
 package.json(s) ───┘
```

> [!WARNING]
> **Release candidate, checked against `alchemy@2.0.0-beta.79`, one known consumer.** Alchemy's CLI and state API still move between betas; `alchemy plan` stays authoritative for what a deploy will do.

## One file, four tests

```ts
// conformance.test.ts
import { alchemyConformance } from "@aurelienbbn/conformance-alchemy/vitest";

alchemyConformance({ root: process.cwd() });
```

**Errors fail; warnings print. Missing evidence (no workflows directory, a package script run from a directory set at run time) shows as a skipped test, never a pass.** `vitest` is an optional peer; Node `^22.19.0 || ^24.11.0`.

```ts
import { runAlchemyConformanceReport } from "@aurelienbbn/conformance-alchemy";

const report = await runAlchemyConformanceReport({ root: process.cwd() }); // { status, checks[], findings[] }
```

| Evaluation    | Cause                                                                           | Vitest  | Report status |
| ------------- | ------------------------------------------------------------------------------- | ------- | ------------- |
| `evaluated`   | ran to completion; can still hold errors                                        | ✅ / ❌ | passed/failed |
| `skipped`     | listed in `skipChecks`                                                          | ⏭️      | incomplete    |
| `unsupported` | no workflows, a script or directory it cannot resolve, an unrecognized `state:` | ⏭️      | incomplete    |
| `failed`      | no stack file, no `alchemy` dependency, invalid YAML/JSON/TypeScript, a throw   | ❌      | failed        |

Findings carry `check`, `severity`, `message`, `path`, a `docs` URL, and `evaluation` when evidence is missing.

## Checks

| Check                      | Fails when                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `alchemy-pinned-exact`     | a workspace `package.json` (or the pnpm catalog it points to) gives `alchemy` a range on a pre-1.0 or prerelease line            |
| `alchemy-state-gitignored` | a directory holding a stack file has no committed rule ignoring `.alchemy/`, or `.alchemy/` files are already tracked            |
| `ci-uses-remote-state`     | a workflow step runs `alchemy deploy` or `destroy` against a stack whose `state:` is `localState()` or `inMemoryState()`         |
| `preview-cleanup`          | a workflow deploys a `pr-*` stage with no `alchemy destroy` of a `pr-*` stage on `pull_request` `closed`; a destroy can hit prod |

<details>
<summary>What each check catches, and its limits</summary>

### alchemy-pinned-exact

```jsonc
"alchemy": "^2.0.0-beta.79"  // ❌ the next lockfile refresh can pull a breaking beta
"alchemy": "catalog:"        // ❌ when pnpm-workspace.yaml has `alchemy: ~2.0.0-beta.79`
"alchemy": "2.0.0-beta.79"   // ✅ also through `catalog:` / `catalog:<name>` resolving to it
```

Betas break without a major bump: `2.0.0-beta.78` made every non-interactive `alchemy deploy` under bun crash in the CLI renderer ([alchemy#1689](https://github.com/alchemy-run/alchemy/issues/1689)). Reads `dependencies`, `devDependencies`, and `optionalDependencies` of the root manifest and every member of `pnpm-workspace.yaml` `packages` or `package.json` `workspaces`. A range whose lower bound is a stable 1.0+ release stays silent. `workspace:`, `file:`, `link:`, and git specs → ⚠️ unsupported. A `catalog:` with no matching entry → ❌ failed. The lockfile is not read.

### alchemy-state-gitignored

```gitignore
# apps/api/alchemy.run.ts
dist/            # ❌ apps/api/.alchemy/ is not ignored
.alchemy/        # ✅ root or apps/api/.gitignore; `.alchemy`, `.alchemy/*`, `**/.alchemy` work too
```

`localState()` writes `.alchemy/state/<stack>/<stage>/*.json`, resource outputs included, under the CLI's working directory. The probe is `<stack dir>/.alchemy/state/`. Inside a git work tree it asks `git check-ignore --no-index`, so every rule git applies counts, then rejects matches from `.git/info/exclude` or a global excludes file: teammates don't share them. `git ls-files` also fails state that is already committed. Without git (not a work tree, no `git` binary), it reads the `.gitignore` files from `root` down to the stack directory with git's pattern rules; files above `root` are not read. A `--config` stack run from another directory writes `.alchemy/` there, which this check does not follow.

### ci-uses-remote-state

```ts
state: localState(),                                          // ❌ with any CI `alchemy deploy`/`destroy` of this stack
state: Cloudflare.state(),                                    // ✅ also AWS.state(), postgresState()
state: process.env.CI ? Cloudflare.state() : localState(),    // ⚠️ warns: confirm CI takes the remote branch
```

A CI runner discards `.alchemy/state` with the job: the next deploy starts from empty state and collides with live resources, and a destroy plans nothing and leaks them. Finds `alchemy <command>` in every `run:` step: bare, `npx`/`bunx`/`pnpx`, `pnpm [exec|dlx]`, `yarn [dlx]`, `bun [x|run]`, `npm exec`, with `cd <dir> &&`, `working-directory` and `defaults.run`. Package scripts (`pnpm ship`, `npm run ship`, `bun run ship`, `yarn ship`) are read from the nearest `package.json` and followed two levels deep, with forwarded arguments appended (`bun run deploy --stage pr-1`; npm only after `--`). Package selection resolves `-C`/`--dir`/`--prefix`/`--cwd`, `-w`/`--workspace`, `-ws`, `-r`, `yarn workspace <name>`, and `--filter`/`-F` by name or path glob. **Anything else that runs a script is reported as unsupported, never dropped**: a directory from `${{ matrix.* }}` or `$VAR`, `--filter` graph selectors (`pkg...`, `!pkg`, `{dir}`), `yarn workspaces foreach`, a third nested script, an unreadable `package.json`. `deploy --dry-run` counts as a plan. The stack file is `<cwd>/<--config or positional or alchemy.run.ts>`, parsed with oxc: `state:` in `Stack(...)`, `Alchemy.Stack(...)`, or `Stack.make(...)`, store constructors recognized only through their `alchemy`, `alchemy/State`, `alchemy/Cloudflare`, `alchemy/AWS` imports, top-level `const`s followed. A workflow with no Alchemy command passes: there is nothing to lose.

### preview-cleanup

```yaml
- run: alchemy deploy --stage pr-${{ github.event.number }} # ❌ alone: every closed PR leaves resources running
# ✅ plus, in a workflow on `pull_request: types: [closed]`:
- run: alchemy destroy --stage pr-${{ github.event.number }}
- run: alchemy destroy --stage prod # ❌ never destroy production from CI
```

The stage is `--stage`, else `ALCHEMY_STAGE`, with `${{ env.X }}`, `$X`, `${X}` substituted from workflow, job, and step `env` (twice, so a job value reading the workflow `env` resolves). A stage containing `pr-` is a preview, which covers the shared `STAGE: ${{ ... format('pr-{0}', ...) || 'prod' }}` pattern of the Alchemy CI guide. The destroy must target the same stack file, unless either side's directory is dynamic. A destroy whose stage is literally `prod` / `production` fails; one whose expression contains either word fails unless a step of the same job, up to the destroy, runs `exit 1` and names either production (the guide's deny check) or `pr-` (an allow-list like `case "$STAGE" in pr-*) ;; *) exit 1;; esac`); the guard's condition is not evaluated. An unresolved script in a `closed` workflow turns a missing cleanup into ⚠️ unsupported, since that script may be the destroy. A branch literally named `prod` reaching `github.ref_name` is invisible to this literal check.

</details>

## Options

| Option         | Default                                  | Used by                                   |
| -------------- | ---------------------------------------- | ----------------------------------------- |
| `root`         | required: the repository root            | all                                       |
| `skipChecks`   | `[]` (unknown ids throw)                 | all                                       |
| `stackFiles`   | `["**/alchemy.run.ts"]`, no node_modules | `alchemy-state-gitignored`                |
| `workflowsDir` | `.github/workflows`                      | `ci-uses-remote-state`, `preview-cleanup` |

Not checked, owned elsewhere: whether a deploy succeeds (`alchemy plan`), provider credentials in CI (`alchemy provider check-env`), `CI=true` for `Cloudflare.state()`, stages set via `$GITHUB_ENV`, reusable workflows and composite actions, CI systems other than GitHub Actions.

## Sources

Independent implementations of Alchemy's [State Store](https://alchemy.run/state-store/), [CI](https://alchemy.run/environments/ci/), and [Stages](https://alchemy.run/environments/stages/) guides and the [deploy](https://alchemy.run/cli/deploy/) / [destroy](https://alchemy.run/cli/destroy/) references, reviewed 2026-09-25 against `alchemy@2.0.0-beta.79` source (`State/LocalState.ts`, `Stack.ts`, `Cli/commands/flags.ts`), and of [alchemy#1689](https://github.com/alchemy-run/alchemy/issues/1689). Source carries greppable `@attribution` tags.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                 | Trigger or review scope                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `alchemy-pinned-exact`     | Every workspace package.json pins alchemy to an exact version (pnpm catalogs resolved) while Alchemy is pre-1.0 or a prerelease. |
| `alchemy-state-gitignored` | Every directory holding a stack file ignores .alchemy/ in a committed .gitignore.                                                |
| `ci-uses-remote-state`     | Every CI alchemy deploy or destroy targets a stack with a remote state store, not localState().                                  |
| `preview-cleanup`          | Every CI deploy to a pr-* stage has a matching alchemy destroy on pull_request closed, and no destroy can target prod.           |

### Credited concepts

- https://alchemy.run/environments/ci/ (inspiration; independently implemented)
- https://alchemy.run/environments/stages/ (inspiration; independently implemented)
- https://alchemy.run/state-store/ (inspiration; independently implemented)
- https://github.com/alchemy-run/alchemy/issues/1689 (inspiration; independently implemented)

<!-- harness-catalog:end -->
