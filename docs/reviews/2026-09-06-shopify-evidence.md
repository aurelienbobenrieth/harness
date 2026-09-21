# Shopify requirements implementation evidence

This record covers the Shopify documentation expansion completed locally on September 6, 2026, following the September 5 source-review batch. No deployment, publication, push, or Shopify submission was performed.

The work adds ten AST rules, seven contextual review rules, five registered conformance checks, and four explicit HTTP/performance helpers. Existing Shopify rules and discovery checks were corrected where their claims exceeded the source evidence. The resulting Shopify App packages expose 18 AST rules, 11 contextual reviews, and nine registered conformance checks.

## Source coverage

The [reviewed ledger](../../policy/shopify-requirements.json) contains all 174 numbered App Store requirements and all 77 numbered Built for Shopify requirements, with one disposition per ID. It records 75 official source pages, including all 47 App Home component references from the inspected index, and maps 44 tool entries plus 32 evidence protocols. Supporting guidance has explicit surfaces; category selection remains separate for the two requirement programs.

This is complete numbered coverage of those two reviewed requirement pages. It is not a claim that every Shopify document, runtime obligation, or category-specific business process has become a static rule. The [adoption guide](../shopify.md) explains how to select tools and retain unresolved evidence.

`node scripts/check-shopify-sources.mjs` fetched all 75 official Markdown sources successfully with no hash drift. The source inventory stores normalized content hashes and links; downloaded documentation stays outside the shipped artifacts. Shopify CLI discovery behavior was independently implemented after checking MIT-licensed source at revision `614187e5204ca6c4bc3c8418b8c6fcb224ab5dae`. Each implementation credits its source concepts.

## Executed checks

Environment: Windows x64, Node 24.15.0, uncommitted workspace based on `1fdd02bd475691d59f139d8627debf970b55482a`. These results describe the tested working state, not an immutable release commit. Commands used existing installed binaries for isolated checks while another authorized task migrated agentlint to draft v0.2. The table distinguishes those local results from the final repository gate.

| Check                                                    | Executed result                                                                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Shopify AST suite                                        | 215 tests passed across 18 files.                                                                                 |
| Shopify agentlint and conformance suites after migration | 320 tests passed across 27 files.                                                                                 |
| Requirement-policy tests                                 | 26 passed, including missing IDs, invalid mappings, category selection, source drift, and pending-state behavior. |
| Built export coverage                                    | 251 requirements, 75 sources, 44 tools, and 74 guidance entries validated.                                        |
| Skill inventory                                          | 11 skills, local links, and invocation metadata validated.                                                        |
| Public baseline consumer                                 | 8 tests passed in three files, zero skipped; 13 tarballs and 17 public exports verified.                          |
| Public current consumer                                  | 8 tests passed in three files, zero skipped; 13 tarballs and 17 public exports verified.                          |

After the agentlint migration, the resumed whole-repository `pnpm check` exited successfully: build, typecheck, lint, formatting, all 1,386 package tests across 193 files, and 128 policy tests passed. Catalog, compatibility, release, skills, and Shopify coverage gates passed in that same run. Earlier attempts caught the defects described below and concurrent rebuilds that temporarily removed declaration artifacts; the resumed run supersedes those partial results. Current output is `.tmp/shopify-resume-check.log`. The resumed workspace dependency audit also reported no known vulnerabilities (`.tmp/shopify-resume-audit.log`).

The resumed public consumer test suites started at 01:35:56 (baseline) and 01:35:57 (current), Europe/Paris on September 6, after the migrated workspace was rebuilt. Each used freshly packed artifacts, a public-registry install with strict peers and engines, a low-level dependency audit, and full declaration checking with `skipLibCheck: false`. They exercised the actual App Home recipe: seven expected diagnostics on broken native/Polaris JSX and no diagnostics on the clean counterpart. Public manifest, response-header, and performance exports were invoked from the packed package.

The baseline/current tool versions are recorded in [compatibility policy](../../policy/compatibility.json). The public consumer profiles exclude the private agentlint drafts. The separate private consumer below verifies their reviewed archive; identical version numbers still do not establish compatibility with public agentlint 0.1.5.

The resumed `pnpm test:package` passed: 21 tarballs, 25 runtime exports, fresh installation and dependency audit, strict declarations, three lint runners, and five scaffold kinds. Its suite started at 01:36:15 Europe/Paris: 33 tests passed across seven files, with three explicitly allowed exclusions (`dead-exports`, `duplication-budget`, and `closed-design-system-probe`) in the minimal core conformance fixture. Every packed agentlint preset ran through the actual parser; the Shopify App Home recipe and conformance/evidence APIs also executed. No declaration error allowance or `skipLibCheck` was used. Current output is `.tmp/shopify-resume-private-consumer.log`.

The former `EmscriptenModule` and Effect `SchemaErrorTypeId` blockers are resolved. The migrated engine exposes structural node types instead of leaking the parser declarations, and the current graph replaces Effect beta.85. The tested `agentlint-current.tgz` has SHA-256 `5e2a515f5bd484f9f7ce6b4ea3fc360204bc3339ae4c5a3f7730e97ea3d060db`; its SHA-512 matches the reviewed compatibility policy. The private publication boundary remains unchanged; see the [migration contract](agentlint-current-contract.md).

Current consumer logs are `.tmp/shopify-resume-registry-baseline.log`, `.tmp/shopify-resume-registry-current.log`, and `.tmp/shopify-resume-private-consumer.log`. Original scoped research logs include `.tmp/shopify-final-domain-tests.log` and `.tmp/shopify-source-check.log`. Logs are local diagnostics; source fixtures and commands in the repository are the reproducible evidence.

## Defects found during independent review

Manifest regressions demonstrated that recursive directory discovery and permissive backup filenames could count undeployed examples as real extensions. Discovery now matches the reviewed CLI directory and filename contracts. Tests also prevent pooling deployment-specific prerequisites, reading unrelated configuration fields as checkout targets, or ignoring extension-specific API-version overrides.

The combined unit run also found one migrated theme test still expecting the old dependency-error wording. Its assertion now checks the actual repository-escape rejection; the negative-path behavior and migration implementation were preserved. The focused five-test registry suite passed after that correction.

Catalog generation previously copied the closing delimiter from an inline attribution comment into Markdown. Formatting escaped that delimiter and made the catalog fail its own freshness check. The generator now removes the comment delimiter; regenerating, formatting, and checking the inventory passed for all 21 packages, 121 rules, and 43 checks.

Performance regressions reproduced a false failure at an exact ten-point reduction, acceptance of array-shaped provenance, and a false pass for sparse metric selections. Fixes use bounded floating-point roundoff and explicit runtime validation. Numerators and denominators must agree with supplied percentages; too little traffic remains incomplete evidence. Storefront comparisons require mobile home, product, and collection scores with the documented weights and comparable environment references.

Listing validation now rejects malformed configuration instead of silently returning no findings. Tests cover text limits, six integrations, five search terms, 25 structured features per category, repeated categories, screenshot counts, contained paths, image headers, and exact-byte duplicates. These checks do not decode image payloads or establish semantic content quality.

The review reconciled conflicting guidance on Page breadcrumbs, Select content, validation timing, image descriptions, and checkout loading. The dedicated checkout guide supports loading necessary initial data before first paint while Shopify retains its skeleton; general best practices also document a sub-second request target. Runtime measurements must establish timing. No universal static latency assertion was added.

## Applicability and remaining app evidence

The example online-store/discount profile produces 112 pending numbered requirements and keeps the plan `unreviewed`. Source coverage and passing helpers never change that into Shopify acceptance. Unspecified categories remain included until triaged; invalid category identifiers fail validation. A BFS plan always includes App Store prerequisites.

Merchant eligibility, real traffic, authentication and tenant isolation, browser/keyboard behavior, required permissions, billing and consent, privacy processing, category workflows, legal/business claims, submission assets, and Shopify approval remain app-owned or external evidence. The new [Shopify review skill](../../skills/shopify-review/SKILL.md) guides that work without treating deterministic findings as completed judgment.
