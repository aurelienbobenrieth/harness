# Release preparation and support

**Harness prepares releases locally and in CI. Publication is disabled.** `pnpm release` and `pnpm release:plan` print a JSON plan and stop: no registry call, version, tag, push, or publish. Unknown flags, including `--publish`, fail.

## Every package is a candidate or a draft

**[policy/release.json](../policy/release.json) classifies all 15 packages; an unlisted addition or removal fails `pnpm release:check`.**

| Class        | Count | Meaning                                                           | Boundary                                                  |
| ------------ | ----: | ----------------------------------------------------------------- | --------------------------------------------------------- |
| ✅ Candidate |     9 | Documented contracts + consumer checks. **Not stable readiness.** | Eligible for preparation; publication disabled globally.  |
| 🧪 Draft     |     6 | Preview with a material adoption limitation.                      | `private: true` required; selecting it for release fails. |

Drafts: 5 agentlint plugins ([unreleased local API](compatibility.md#private-draft-boundary)) and `oxlint-plugin-tanstack-query` (rules untested against consumers). They pack and test locally; **candidates' runtime, optional, and peer dependencies cannot require one.** Parked outside the repo: 4 Shopify theme packages, both Lit plugins, `oio`.

<details>
<summary>How Changesets treats private drafts</summary>

Changesets versions private packages (`privatePackages.version: true`) so mixed changesets and changelogs stay useful, but does not tag them (`tag: false`). `private: true` is the npm/Changesets publication boundary. `ignore` is deliberately unused: its mixed ignored/non-ignored restrictions would reject existing shared changesets. See [Changesets configuration](https://changesets.dev/guide/config).

</details>

## Five gates, then read the plan

```mermaid
flowchart LR
  C["pnpm check"] --> S["security:check"]
  S --> P["test:package"]
  P --> B["compat baseline"]
  B --> U["compat current"]
  U --> R["release:plan"]
  R --> H{"blockers left?"}
  H -- yes --> F["fix, rerun"]
  H -- no --> V["reviewed version change"]
```

```sh
pnpm release:plan                                          # all candidates
pnpm release:plan --package @aurelienbbn/oxlint-plugin-core  # a subset
```

Reports commit, dirty state, candidate versions, draft exclusions, blockers (publication disabled is always one). **A successful plan means a valid inventory, not resolved blockers.** All 15 packages are `0.0.0` until a reviewed version change.

## Three workflows, none publishes

```text
ci.yml       CI               PR · push to main · manual  ─▶ 8 legs ─▶ Validate
publish.yml  Prepare release  manual, main only           ─▶ reruns every gate on a reviewed SHA, prints plan
release.yml  Release          push to main                ─▶ release:check, then Changesets version PR
```

```text
                 Linux  Windows
Node 22            ●       ●     full suite: check, audit, test:package, both profiles
Node 24            ●       ●     full suite
Node 22.19.0       ●       ●     floor: build + both registry profiles
Node 24.11.0       ●       ●     floor: build + both registry profiles
                   └───────┴──▶  Validate: passes only if all 8 pass (existing branch-protection name)
```

Local runs don't prove remote ones. **Prepare release rejects a SHA that differs from the workflow revision or checkout**; inputs via environment variables, time-bounded jobs, serialized runs.

> [!IMPORTANT]
> **Version PRs don't trigger CI on their own.** Opened with `GITHUB_TOKEN`, they get approval-required runs, and their pushes start no push workflows. Approve those runs or run **CI** manually on the version branch, and require the result before merge. See [triggering workflows with GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

## Repository settings: verified vs not configured

**Canonical repo `aurelienbobenrieth/harness`, npm scope `@aurelienbbn`**; metadata and changelog links must match. ✅ security reporting, alerts, Dependabot, secret scanning, **Validate**-protected main · ⚠️ 0 required approvals · ❌ no npm publisher or release environment.

<details>
<summary>Settings evidence</summary>

| Setting                                      | State             | Evidence                                  |
| -------------------------------------------- | ----------------- | ----------------------------------------- |
| canonical repository                         | ✅                | GitHub, 2026-09-05                        |
| private vulnerability reporting              | ✅ enabled        | GitHub API, 2026-09-21                    |
| vulnerability alerts                         | ✅ enabled        | GitHub API, 2026-09-21                    |
| Dependabot security updates                  | ✅ enabled        | GitHub API, 2026-09-21                    |
| secret scanning + push protection            | ✅ unchanged      | previously verified                       |
| main protection: fresh **Validate** required | ✅                | GitHub API, 2026-09-21                    |
| main protection includes administrators      | ✅                | GitHub API, 2026-09-21                    |
| required approvals                           | ⚠️ 0              | one collaborator, also the sole CODEOWNER |
| npm trusted publisher                        | ❌ not configured | none set up by these repo changes         |
| GitHub release environment                   | ❌ not configured | none set up by these repo changes         |

- Zero approvals is deliberate: with one collaborator, a required independent approval blocks routine maintenance. Revisit before adding maintainers or enabling publication.
- CODEOWNERS records ownership; it adds no independent reviewer.
- Checked-in Dependabot config schedules weekly npm and GitHub Actions PRs on the default branch; the repo setting allows vulnerability-driven ones. Neither proves a future run succeeded.

</details>

## Turning publication on takes a reviewed change

It keeps candidate selection and draft exclusions. First:

- [ ] verify exact repository and workflow identity
- [ ] verify npm ownership of `@aurelienbbn`
- [ ] verify the private security-reporting route
- [ ] confirm passing CI on the reviewed revision
- [ ] configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/); verify repository, workflow filename, environment identity
- [ ] only then grant the publisher `id-token: write`

## Every action is pinned to a commit

**Pinning freezes the revision; it doesn't audit the action or its downloads.** YAML policy checks catch drift; they don't sandbox shell commands or replace workflow review.

<details>
<summary>Pins and rejected drift</summary>

Resolved from each action's canonical repository on 2026-09-05, annotated tags peeled to commits:

| Action             | Release | Commit                                     |
| ------------------ | ------- | ------------------------------------------ |
| actions/checkout   | v5.1.0  | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` |
| actions/setup-node | v5.0.0  | `a0853c24544627f65ddf259abe73b1d18a591444` |
| pnpm/action-setup  | v5.0.0  | `fc06bc1257f339d1d5d8b3a19a8cae5388b55320` |
| changesets/action  | v1.7.0  | `6a0a831ff30acef54f2c6aa1cbbc1096b066edaf` |

Rejected: mutable action references · unexpected token permissions · persisted checkout credentials outside the version writer · stored release secrets · skipped aggregate checks · ignored validation failures, including via expressions · excluded runtime matrix legs · runtime setup not using the matrix · a Changesets publishing input · the version PR writer invoking Changesets before its release-policy gate.

GitHub guidance: [immutable references and least privilege](https://docs.github.com/en/actions/reference/security/secure-use), [workflow failure controls](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepscontinue-on-error).

</details>

## Support covers latest source and tested profiles only

✅ latest source · ✅ tool profiles exercised by consumer tests · ❌ future tool majors · ❌ enterprise SLA · ❌ historical security backports. Updates pass the same validation as any change; preview dependencies state provenance and compatibility.

Defects: [issues](https://github.com/aurelienbobenrieth/harness/issues) · Vulnerabilities: [SECURITY.md](../SECURITY.md)
