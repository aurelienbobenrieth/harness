# Release preparation and support

Harness prepares releases locally and in CI. **Publication is disabled.** `pnpm release` and `pnpm release:plan` print JSON; they never invoke a registry, create a version, tag, push, or publish. Unknown flags, including `--publish`, fail.

## Package maturity

[policy/release.json](../policy/release.json) classifies every package explicitly. Adding or removing a package without updating this inventory fails `pnpm release:check`.

| Classification | Meaning                                                                                                          | Publication boundary                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Candidate      | A package under evaluation with documented contracts and consumer checks. This does not assert stable readiness. | Eligible for preparation; publication remains disabled globally.                    |
| Draft          | Preview tooling with a material adoption limitation.                                                             | The package manifest must set `private: true`; an explicit release selection fails. |

The five agentlint plugins depend on an unreleased local agentlint API; the registry package with the same version does not establish compatibility. All five remain private. `@aurelienbbn/oxlint-plugin-tanstack-query` is a sixth private draft: its rules are new and have not yet been exercised against consumer projects or the registry compatibility profiles. Seven packages are parked outside this repository until a later release: the four Shopify theme packages, both Lit plugins, and `oio`. Candidate runtime, optional, and peer dependencies cannot require a draft package. Local packing and testing of drafts remain supported.

Changesets versions private packages so their mixed changesets and changelogs remain useful, but does not tag them. `private: true` supplies the npm/Changesets publication boundary. Changesets `ignore` is intentionally unused: its mixed ignored/non-ignored changeset restrictions would reject existing shared changesets. See [Changesets configuration](https://changesets.dev/guide/config).

## Inspect a release

Run `pnpm check`, `pnpm security:check`, `pnpm test:package`, `pnpm test:compatibility baseline`, and `pnpm test:compatibility current`, then inspect `pnpm release:plan`. Select a subset with `pnpm release:plan --package @aurelienbbn/oxlint-plugin-core`. The plan reports the current commit, dirty state, candidate versions, draft exclusions, and remaining blockers. A successful plan command means the inventory is valid; it does not mean its blockers are resolved. Existing `0.0.0` versions require a reviewed version change before stable publication.

The manual **Prepare release** workflow accepts a full reviewed SHA. It runs only from main and rejects a SHA that differs from the workflow revision or checkout. Inputs are passed through environment variables. All validation and packed-consumer checks run again before the plan is printed. Jobs are time bounded and concurrent preparations are serialized.

The full CI matrix covers Linux/Windows and current Node 22/24. A separate matrix builds packages and checks both registry-tool profiles on each OS at the exact Node floors, 22.19.0 and 24.11.0. The aggregate job named **Validate** passes only when all eight matrix legs succeed, preserving the existing branch-protection status name. Local validation does not prove these remote executions passed.

The version workflow can create a Changesets PR using only the repository `GITHUB_TOKEN`. GitHub's current documented behavior creates approval-required workflow runs for PRs opened, synchronized, or reopened by that token; its push events do not start ordinary push workflows. Approve those PR workflows, or run **CI** manually on the version branch, and require their result before review and merge. See [triggering workflows with GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

## Before enabling publication

A reviewed future change must implement actual publication, while retaining candidate selection and private draft exclusions. First verify the exact repository/workflow identity, npm ownership, the configured private security-reporting route, and passing CI for the reviewed revision. Configure npm trusted publishing and verify its repository, workflow filename, and environment identity before granting the publisher `id-token: write`. No npm publisher or GitHub environment has been configured by these repository changes. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

The canonical repository verified through GitHub on 2026-09-05 is `aurelienbobenrieth/harness`; the npm scope remains `@aurelienbbn`. Repository metadata and Changesets changelog links must agree with that identity.

GitHub API evidence was refreshed on 2026-09-21:

- Private vulnerability reporting, vulnerability alerts, and Dependabot security updates are enabled.
- The previously verified secret scanning and secret-scanning push protection settings were not changed.
- Main branch protection requires a fresh **Validate** status and includes administrators.
- Required approvals remain zero. The repository has one direct collaborator, who is also the sole CODEOWNER, so requiring an independent approval would make routine maintenance impossible. Revisit this choice before adding maintainers or enabling publication.

CODEOWNERS documents current ownership; its presence does not add an independent reviewer. The checked-in Dependabot configuration schedules dependency/action update PRs on the default branch, while the repository-level security-update setting allows vulnerability-driven updates. Neither proves that a future update run succeeded.

## Workflow dependencies

Workflow actions are pinned to full commit SHAs. References were resolved from each action's canonical repository on 2026-09-05, including peeling annotated tags to commit objects:

| Action             | Release | Commit                                     |
| ------------------ | ------- | ------------------------------------------ |
| actions/checkout   | v5.1.0  | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` |
| actions/setup-node | v5.0.0  | `a0853c24544627f65ddf259abe73b1d18a591444` |
| pnpm/action-setup  | v5.0.0  | `fc06bc1257f339d1d5d8b3a19a8cae5388b55320` |
| changesets/action  | v1.7.0  | `6a0a831ff30acef54f2c6aa1cbbc1096b066edaf` |

Pinning makes the referenced revision immutable; it does not audit the action or its downloaded dependencies. YAML policy checks reject mutable action references, unexpected token permissions, persisted checkout credentials outside the version writer, and stored release secrets. They also reject skipped aggregate checks, ignored validation failures (including expressions), excluded runtime matrix legs, runtime setup that does not use the matrix, and a Changesets publishing input. The version PR writer must run its release-policy gate before invoking Changesets. These checks detect configuration drift; they do not sandbox arbitrary shell commands or replace review of executable workflow changes. GitHub documents [immutable action references and least privilege](https://docs.github.com/en/actions/reference/security/secure-use) and [workflow failure controls](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepscontinue-on-error).

## Support expectations

Maintainers review the latest source and the supported tool profiles exercised by consumer tests. Future tool majors are outside that evidence. Updates need the same package and consumer validation as other changes; preview dependencies require their provenance and compatibility to be explicit. There is no enterprise support SLA or historical security-backport commitment. Report reproducible defects through [issues](https://github.com/aurelienbobenrieth/harness/issues) and vulnerabilities through [SECURITY.md](../SECURITY.md).
