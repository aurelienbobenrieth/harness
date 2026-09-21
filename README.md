# Harness

Reusable lint rules, tool configurations, conformance checks, and operating skills for TypeScript projects.

Nine packages are release candidates. Six packages are private drafts with documented adoption limits: the five agentlint plugins and `@aurelienbbn/oxlint-plugin-tanstack-query`. Seven packages are parked outside this repository until a later release: the four Shopify theme packages, both Lit plugins, and `oio`. **Publishing is disabled:** `pnpm release` prints a preparation plan. See the [executed readiness evidence](docs/reviews/2026-09-05-readiness.md), [release policy](docs/release-readiness.md), and [consumer compatibility](docs/compatibility.md).

## Packages

- `@aurelienbbn/oxlint-config`: reusable oxlint config presets made from existing oxlint rules.
- `@aurelienbbn/oxlint-plugin-core`: custom oxlint rules for TypeScript projects.
- `@aurelienbbn/oxlint-plugin-effect`: custom oxlint rules for Effect projects.
- `@aurelienbbn/oxlint-plugin-shopify-app`: custom oxlint rules for Shopify app and extension code.
- `@aurelienbbn/oxlint-plugin-xstate`: custom oxlint rules for XState machines and actors.
- `@aurelienbbn/oxlint-plugin-tanstack-query`: custom oxlint rules for TanStack Query failure modes the official plugin does not cover (private draft).
- `@aurelienbbn/oxlint-plugin-type-evidence`: custom oxlint rules for explicit TypeScript boundary and assertion contracts.
- `@aurelienbbn/agentlint-plugin-core`: custom agentlint rules for general TypeScript projects.
- `@aurelienbbn/agentlint-plugin-effect`: custom agentlint rules for Effect projects.
- `@aurelienbbn/agentlint-plugin-tanstack-query`: custom agentlint rules for TanStack Query projects.
- `@aurelienbbn/agentlint-plugin-shopify-app`: custom agentlint rules for Shopify app and extension code.
- `@aurelienbbn/agentlint-plugin-xstate`: custom agentlint rules for XState machines and actors.
- `@aurelienbbn/conformance-shopify-app`: structural conformance checks for Shopify apps, packaged as a Vitest suite.
- `@aurelienbbn/conformance-core`: project-agnostic repository checks with explicit coverage reports and a Vitest adapter.
- `@aurelienbbn/oxfmt-config`: reusable oxfmt config presets made from existing formatter settings.

## Package Taxonomy

- `*-config` / `*-preset`: bundles existing rules into recommended combinations.
- `*-plugin`: defines new rule implementations.
- `conformance-*`: structural checks over manifests, file layout, and build output, consumable as a Vitest suite or programmatically.

Rules should live in the narrowest reusable domain that fits them, for example `effect` for Effect-specific rules and `core` for technology-agnostic rules.

## Rule implementation policy

Rules that have one safe mechanical rewrite must provide an autofix and test it. Rules whose fix requires project knowledge, such as choosing an Effect Schema decoder or encoder, should report only and leave the change to the developer.

## Review follow-up and validation

Defaults deliberately optimize for these projects. Architecture preferences, deterministic diagnostics, and agent review prompts have different contracts; see each package's generated inventory and migration notes.

- `pnpm check`: build, source typecheck, lint, formatting, unit tests, and repository policy/catalog gates.
- `pnpm quality:check`: require a clean Knip report and keep production-source duplication at or below the reviewed 28-clone baseline; tests, fixtures, generated output, documentation, and vendored archives are excluded.
- `pnpm review:rules`: regenerate the interactive rule/check triage in `docs/reviews/rule-triage.html`; `pnpm check` rejects a stale artifact.
- `pnpm security:check`: audit all dependency classes against current registry advisories; required separately in CI and release preparation because it needs network access.
- `pnpm test:compatibility baseline` / `current`: install the 9 packed candidates outside the workspace using reviewed public-registry tool versions, strict peers and engines, and complete declaration checking. No local dependency archive, alias, or declaration waiver is used.
- `pnpm test:package`: exercise all 15 packed packages, including the private drafts, against the reviewed local agentlint archive and Vite Plus alias. Checks cover public APIs, the oxlint and agentlint runners, and conformance suites.
- `pnpm release:plan`: inspect candidate versions, draft exclusions, working-tree status, and publication blockers without changing files or contacting a registry.
- `pnpm policy`: regenerate the shared Theme OS defaults from `policy/theme.json`.
- `pnpm catalog`: refresh exported rule/check inventories and credited concepts after building.
- `pnpm test`: rebuild before running tests. The old watch script was removed because edits could leave the subprocess rules testing stale dist files.

The [roadmap implementation record](docs/reviews/2026-09-05-roadmap-implementation.md) lists the completed reliability work, concrete acceptance fixtures, migration impact, and remaining coverage boundaries.

The 15-package consumer and both candidate registry profiles require complete TypeScript dependency declarations. The former Effect and Vite Plus declaration exceptions have been removed; these commands use neither `skipLibCheck` nor an error allowlist. The agentlint plugins still require the reviewed private archive or built sibling workspace and remain incompatible with public agentlint 0.1.5. See the [current migration contract](docs/reviews/agentlint-current-contract.md).

CI covers Linux/Windows with current Node 22/24 and separate checks at the declared runtime floors. A configured matrix is not evidence that its remote runs passed. See [compatibility evidence](docs/compatibility.md) for the actual local runs and [the remediation backlog](docs/reviews/2026-09-05-remediation-and-roadmap.md) for remaining work.

## Operating skills

The [Shopify tooling guide](docs/shopify.md) connects App Store and Built for Shopify requirements to scoped lint rules, conformance, contextual review, and app-owned runtime evidence. It includes a tested App Home lint recipe and a source-drift-aware review planner.

The [skills guide](docs/skills.md) explains the communication, build, testing, git, and toolsmith guidance, automatic versus explicit invocation, independent fixture evaluations, and source credits. Deterministic policy belongs in executable checks; skills carry the context-dependent decisions those checks cannot make.

Use [CONTRIBUTING.md](CONTRIBUTING.md) for changes and validation, [SECURITY.md](SECURITY.md) for vulnerability-reporting status, and [CODEOWNERS](.github/CODEOWNERS) for maintainer ownership.
