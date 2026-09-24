---
name: install-harness
description: Add matching Harness lint, format, or conformance packages to a consumer project when the user requests installation or tooling setup. Inspect stack and compatibility, pin verified package versions, merge existing configuration, and validate adoption. Does not install packages during an ordinary review or explanation.
---

# Install Harness

Install only the tooling justified by the consumer's stack and requested scope. Read the consumer's instructions, manifests, lockfile, existing configuration, and dirty worktree before editing. Use its package manager and preserve unrelated changes.

## Select packages and versions

Inspect actual source and dependencies. TypeScript may use the core oxlint/config packages; Effect, Lit, XState, Shopify apps, and Shopify themes have separate domains. A package name in documentation alone is insufficient evidence that the project needs that domain. Conformance checks need their own project inputs, not just an installed dependency.

Read Harness's current package README, compatibility policy, and release eligibility before selecting a version. Confirm that version exists in the configured registry and that its published manifest supports the consumer's Node and tool versions. Use exact versions. A registry's newest version is not automatically compatible; never invent a release to fill a gap.

Harness's five agentlint plugins currently use private preview contracts. The checked-in agentlint archive and public npm package have different APIs under the same version. Do not install a public agentlint version as a substitute for that archive. Preview adoption requires an explicitly local setup with the reviewed artifacts and their verified integrity.

If a selected package has no eligible published version, report that installation limit and finish the supported subset. Use local tarballs only when the task includes local preview adoption. Never publish a package to complete installation.

## Merge and verify

Make a targeted configuration merge. Preserve the consumer's existing ignores and rules; add an exclusion only when its purpose is established. Do not blanket-ignore agent directories, replace whole configurations, or run an initializer that overwrites existing files.

Follow the selected package's documented exports and registration. Avoid assuming a plugin helper, peer package, or command exists across tool versions. Use a sample of actual consumer source to expose rule noise before enabling a new policy as a blocking error. A project-specific policy choice belongs in consumer configuration.

Run the consumer's relevant required checks. Distinguish configuration or dependency failures from findings in existing source. Fix installation defects within scope; preserve and report source findings unless fixing them is part of the request. A justified, documented exception is a policy decision, not something to hide to make the run pass.

When the request includes Harness skills, add one line to the consumer's always-loaded instructions (`AGENTS.md`, `CLAUDE.md`, or the host equivalent) telling agents to read the installed communication skill before their first reply. Keep every other skill discoverable, not bootstrapped.

Finish with installed package versions, meaningful configuration changes, check results, and any blocked or intentionally omitted portion of the requested setup. Group omissions by reason rather than listing every irrelevant package.
