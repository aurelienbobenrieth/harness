# Harness readiness evidence, 2026-09-05

Harness is ready for controlled adoption of the tested configurations. It is not uniformly enterprise-ready: thirteen packages are release candidates, eight are private previews, and production environment acceptance remains separate. All repository edits remain local; nothing was deployed or published.

## What improved

- Dependency remediation reduced the complete workspace audit from 24 advisories to zero, including the critical Vitest browser issue. Compatible updates required no ignored advisories or new security overrides. The supported floor is now Node 22.19.0; the previous 22.18.0 claim did not satisfy the draft CLI's dependency requirements.
- Registry consumers now use explicit baseline/current tool profiles, strict peer and engine installation, complete declaration checking, and fresh dependency audits. Public config types no longer leak unrelated Vite Plus build-tool declarations.
- Release preparation classifies every package, excludes private drafts, binds manual preparation to a reviewed main SHA, and checks pinned actions, permissions, required gates, and matrix execution. Publishing is disabled. Contribution, security, ownership, and support documents state the actual boundaries.
- Core conformance no longer reports unavailable optional tools as passing Vitest tests. Unavailable evidence is skipped, failed execution fails, and evaluated advisory warnings still pass. A real Vitest subprocess reproduced the false green before the fix and verifies all three outcomes plus required-tool failures.
- Consumer runners reject empty selection, missing files, unfinished tests, unexpected skips, and inconsistent counts. They exercise actual type-aware lint diagnostics and compile the corrected design-system skill example. Diagnostic documentation links now point to the canonical repository and are checked for drift.
- Ten operating skills were reviewed and tightened, including the requested communication, build, testing, git, and toolsmith skills from KeepCart. They preserve existing authorization, use proportionate proof, and avoid rigid line limits or invented attention guarantees. KeepCart was inspected without changing its installed copies.

## Executed validation

| Check                         | Observed result                                                                                       | Scope                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`                  | 898 package tests across 157 files; 102 policy tests; build, types, lint, format, and catalogs passed | Windows x64, Node 24.15.0; 21 packages, 104 rules, 38 checks                                                                                     |
| Workspace dependency audit    | Zero advisories across 486 resolved dependencies                                                      | Runtime, development, and optional categories; current registry knowledge                                                                        |
| Registry baseline and current | Both profiles passed on Node 22.19.0, 24.11.0, and 24.15.0                                            | Six Windows combinations; each audits its graph and verifies 13 archives, 17 exports, strict declarations, six tests, zero skips                 |
| `pnpm test:package`           | 26 passed; three explicitly allowed skips                                                             | 21 archives, 25 exports, seven test files, all lint runners, all five scaffold kinds, generated tests and DOM behavior; fresh graph audit passed |
| Skills                        | All ten pass both Skill Creator validation and the repository structure check                         | Metadata and local references; behavioral evidence is separate below                                                                             |
| Release plan                  | Preparation-only output, 13 candidates and eight excluded drafts                                      | Dirty worktree and `0.0.0` versions remain visible blockers; no registry operation                                                               |

The policy tests comprise 54 release, 24 compatibility, 18 skill-structure, and six consumer-result cases. The full gate therefore executes 1,000 tests; this count is not a completeness measure.

The portable Node archives were checked against official SHA-256 manifests: [Node 22.19.0](https://nodejs.org/dist/v22.19.0/SHASUMS256.txt) and [Node 24.11.0](https://nodejs.org/dist/v24.11.0/SHASUMS256.txt). Linux execution is configured in CI but was not performed in this local session.

## Skill usefulness and model limits

The [operating-skill evaluation](2026-09-05-skill-evaluation.md) exercised generated-state repair, a scoped commit preserving unrelated staged/unstaged work, and a filesystem scaffold with preview and collision refusal. The generated-code and scaffold gates were independently rerun, and the disposable commit and remaining diffs were inspected.

The [Astra record](../../evals/skills/astra.json) preserves an unsupported contention inference and successful follow-up explanations. The [Fable 5.1 evaluation](2026-09-05-fable-evaluation.md) records seven actual model responses, including failures that persisted after prompt revision. Fable retained important distinctions but still over-inferred in readiness summaries. These are small text probes, not controlled model comparisons, proof of autonomous execution, automatic-routing tests, or reader-attention measurements.

The [skills guide](../skills.md) compares automatic, explicit, always-loaded, and deterministic mechanisms and credits independently adopted ideas from Dillon Mulroy and Matt Pocock. No third-party skill text or templates were imported.

## Remaining release boundaries

The seven agentlint plugins depend on a reviewed local archive whose API differs from the public package with the same version. They remain private until a distinctly versioned compatible upstream release and registry acceptance exist. oio remains private because crash recovery and production browser/Shopify acceptance are incomplete. Its local consumer still reports the narrow Effect beta declaration exception; the thirteen registry candidates have no declaration waiver.

Live Shopify behavior, browser accessibility, workload performance, exhaustive lint precision, and compiler-backed whole-program analysis are outside the current evidence. The [roadmap](2026-09-05-remediation-and-roadmap.md) retains those investments. GitHub's private reporting route and review policy need maintainer configuration before public release; this session did not change external settings. See [release readiness](../release-readiness.md) and [consumer compatibility](../compatibility.md).

## Reproduce and inspect

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm security:check
pnpm test:compatibility baseline
pnpm test:compatibility current
pnpm test:package
pnpm release:plan
```

Session-local logs are available at `.tmp/readiness-check.log`, `.tmp/readiness-security-final.json`, `.tmp/readiness-registry-{baseline,current}-{22.19,24.11,24.15}.log`, `.tmp/readiness-draft-24.15.log`, and `.tmp/readiness-release-plan.json`. The logs are ignored artifacts and may be removed by local cleanup; the commands, contract policies, regression suites, and preserved model transcripts are maintained in the repository.
