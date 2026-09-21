# Consumer compatibility

Nine packages are public release candidates. Six remain private drafts: the five agentlint plugins and `@aurelienbbn/oxlint-plugin-tanstack-query`. Seven packages are parked outside this repository until a later release: the four Shopify theme packages, both Lit plugins, and `oio`. All publication remains disabled. Compatibility is evidence for the specified consumers, not certification of every downstream project.

## Supported hosts

The executable contract is [policy/compatibility.json](../policy/compatibility.json). All packages support Node `^22.19.0 || ^24.11.0` and ESM imports. New Node majors and unlisted pre-1.0 tool release families require review before the ranges change. The Node 22 floor accounts for the draft CLI's Undici dependency, which requires 22.19.0 or later.

| Host            | Declared support    | Baseline test | Current compatible test |
| --------------- | ------------------- | ------------- | ----------------------- |
| oxlint          | `>=1.82.0 <2.0.0`   | 1.82.0        | 1.83.0                  |
| oxlint-tsgolint | `^7.0.2001`         | 7.0.2001      | 7.0.2002                |
| oxfmt           | `>=0.67.0 <0.69.0`  | 0.67.0        | 0.68.0                  |
| vite-plus       | `^0.3.2`            | 0.3.2         | 0.3.2                   |
| Vitest          | `>=4.1.11 <5.0.0`   | 4.1.11        | 4.1.11                  |
| Stylelint       | `>=17.15.0 <18.0.0` | 17.15.0       | 17.15.0                 |

Both profiles also pin TypeScript 7.0.2, Vite 8.3.0, Node declarations 22.20.3, Lit 3.3.3, XState 5.33.2, and jsdom 30.1.0. `current` means the reviewed versions within the supported families; it never resolves a floating dist-tag. The baseline is the toolchain Vite Plus 0.3.2 bundles. Vitest 5 is outside this contract because Vite Plus pins Vitest 4.1.11. Vite Plus 0.3.3 was published on 2026-09-18 and waits for pnpm's minimum release age. `conformance-shopify-theme` keeps TypeScript 6.0.3 as its runtime dependency: TypeScript 7 no longer exposes the compiler API it uses to resolve event names.

Versions and peer metadata were checked against the public npm registry on 2026-09-18. Sources: [oxlint metadata](https://registry.npmjs.org/oxlint/1.83.0), [Vite Plus metadata](https://registry.npmjs.org/vite-plus/0.3.2), [Vitest metadata](https://registry.npmjs.org/vitest/4.1.11), [Stylelint metadata](https://registry.npmjs.org/stylelint/17.15.0).

## Reproduce the evidence

Each consumer command audits its fresh dependency graph before running fixtures. The workspace's clean audit alone cannot establish the registry consumer's result, because the tool aliases and transitive resolutions differ. Registry audit failures fail the consumer command.

```sh
pnpm check
pnpm test:compatibility baseline
pnpm test:compatibility current
pnpm test:package
pnpm security:check
```

Build before the consumer tests: packing deliberately reuses the artifacts that were just validated. Each registry profile packs the candidates selected by [release policy](../policy/release.json), installs them outside the workspace with public registry dependencies, and removes its temporary consumer afterward. It enforces strict peers and engines, disables automatic peer installation and lifecycle scripts, checks installed direct versions, and uses no overrides or local dependency archives. Transitive dependencies follow their upstream manifests; these consumers are a fresh-install compatibility test, not a fully locked reproduction of the workspace.

Each profile verifies 9 archives, 11 exports, matching licenses, README files, complete TypeScript declarations with `skipLibCheck: false`, and seven consumer tests. The behavioral cases cover every oxlint plugin in one policy, the Shopify App Home recipe, the formatter configuration, the strict type-aware lint configuration, and APIs from both conformance packages. Every behavioral runner/check is exercised with both passing and failing inputs. No tests are skipped in these profiles.

The strict lint fixture requires a real TypeScript assignment diagnostic from oxlint-tsgolint and a clean rerun after correcting the input. Both consumer commands also compile the shipped closed-design-system skill example against installed package declarations; this checks its API wiring, without claiming that its Tailwind build ran.

Consumer commands validate Vitest's JSON report as well as its exit status. Every selected test file must appear, passing tests must execute, and unfinished or unexpected skipped tests fail the command. Registry profiles allow no skips. The draft consumer permits each of its three named core exclusions once, only in the original acceptance suite. Six report-validation regression cases exercise empty execution, missing files, misleading counts, failures, and exclusions in the wrong suite or file.

Before the dependency remediation on 2026-09-05, both profiles passed on Windows x64 using Node 22.18.0, 24.11.0, and 24.15.0: six successful combinations, each with six passing tests and zero skips. Those runs used the former Vite Plus 0.2.1 / Vitest 4.1.9 baseline and are historical evidence, not validation of the patched contract above. The two minimum-version runs used official portable Node archives verified against their published SHA-256 checksums. The CI matrix supplies Linux and newer-patch evidence when it runs; a configured workflow is not a passed workflow.

The full dependency audit initially reported 24 advisories, including the browser runner's critical file-access defect. The remediated lockfile reports zero known advisories across all dependency categories as of 2026-09-05. The baseline now starts at Vite Plus 0.2.4 and Vitest 4.1.10, the first compatible releases carrying that browser fix. Direct parsers use PostCSS 8.5.23 and smol-toml 1.6.1; compatible transitive refreshes resolve Undici 8.10.2, TOML 4.3.0, nanoid 3.3.18, js-yaml 3.15.2 / 4.3.2, and fast-uri 3.1.7. No advisory IDs are ignored and no security overrides force dependencies across major versions. `pnpm security:check` checks the complete graph and requires registry access; it remains separate from the deterministic local check. An empty advisory report establishes the registry's current known findings, not absence of every vulnerability.

The changes follow upstream advisories for [Vitest browser file access](https://github.com/advisories/GHSA-p63j-vcc4-9vmv), [PostCSS source maps](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [smol-toml recursion](https://github.com/advisories/GHSA-v3rj-xjv7-4jmq), [Undici cache handling](https://github.com/advisories/GHSA-4cwx-7wf7-3272), [TOML recursion](https://github.com/advisories/GHSA-82x6-q7mm-w9cf), [nanoid zero sizes](https://github.com/advisories/GHSA-2v37-7h3g-55p8), [js-yaml resource exhaustion](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), and [fast-uri normalization](https://github.com/advisories/GHSA-f65p-4m7j-42xc).

The patched baseline and current profiles were then rerun on Windows x64 with Node 22.19.0, 24.11.0, and 24.15.0. All six combinations passed their fresh dependency audit, strict declaration checks, and six tests with zero skips. The final draft consumer also passed its fresh audit and 26 tests with three approved skips. These runs validate the corrected support contract; the [consolidated readiness record](reviews/2026-09-05-readiness.md) lists evidence and reproduction commands.

## Private draft boundary

The local `@aurelienbbn/agentlint` archive and the public npm archive both identify as 0.1.5, but expose incompatible APIs. Public 0.1.5 has `AgentReviewNode`, `context.flag`, and rule `meta`; the local archive has `AgentlintNode`, `context.report`, and versioned `standard`/`detector`/`binding` contracts with explicit `state`/`change` lifecycles. Their SHA-512 hashes differ. [Public archive metadata](https://registry.npmjs.org/@aurelienbbn%2Fagentlint/0.1.5) and the reviewed local hash are recorded in the compatibility policy.

The five active plugins therefore cannot claim public agentlint 0.1.5 support. Their exact-version peer is a local integration constraint; `private: true` and release-policy checks prevent accidental publication. Promotion requires an independently versioned compatible upstream release, registry-only consumer acceptance, and an explicit maturity change.

The pre-migration local consumer passed 26 tests with three intentional conformance skips and loaded 25 public exports. That historical run used Effect beta.85 and does not validate the current engine archive. Its obsolete declaration-error exception has been removed; registry consumers require complete dependency declarations.

Current local development links all five plugins to the built sibling agentlint workspace. `pnpm test:agentlint-current` checks six packed archives with the exact local runtime dependency graph, typed consumer imports, real parser fixtures, and all five domains through the CLI. This does not require a registry installation. The engine also passes a separate fresh npm tarball smoke, including strict TypeScript and acceptance. The complete active harness graph passes the separate 15-package consumer described below. See the [current migration review](reviews/agentlint-current-contract.md) for scopes, semantic changes and the publication boundary.

The configuration packages now import their host types through `vite-plus/lint` and `vite-plus/fmt`. This preserves the underlying public types while avoiding an unrelated build-tool declaration chain, removing the former Vite Plus declaration exception from their consumer contract.

## Updating the contract

Update the pinned profile and package peer range together, add regression cases for any observed incompatibility, regenerate the lockfile if development dependencies changed, and run the commands above. `pnpm compatibility:check` rejects missing host peers or profiles, unbounded or empty Node/peer ranges, unpinned profile versions, test hosts outside their declared peer ranges, mismatched Node support, and unreviewed local agentlint archive changes. Twenty-four regression tests exercise acceptance and rejection paths. The baseline must match the development toolchain wherever a tool is a root dependency.

The range check independently implements the exact, caret, and bounded stable intervals used here, following the [node-semver range semantics](https://github.com/npm/node-semver#caret-ranges-123-025-004) (ISC). It intentionally rejects other range syntax; extending the policy requires corresponding acceptance and rejection tests.

Static conformance and jsdom scaffold tests do not establish production browser accessibility, live Shopify acceptance, load performance, or recovery from interrupted filesystem writes. Those remain separate acceptance requirements for the consuming project and the draft CLI.

The full `pnpm test:package` consumer packs all 15 active packages and only `packages/*`, excluding the private workspace root. The 2026-09-21 run passed fresh installation, dependency audit, strict TypeScript, 17 runtime exports, both lint runners, and 20 tests. Four explicit skips cover checks that a minimal consumer cannot or does not configure: dead exports, duplication budget, the CSS build probe, and TypeScript strictness. The local Agentlint archive and harness share Effect and both Node platform packages at `4.0.0-rc.115`. No `skipLibCheck` or declaration exemption is used.
