---
name: install-harness
description: Add Harness lint, format, conformance packages, and skills to a consumer project, matched to its actual stack and pinned to verified versions. Use when the user asks to install, set up, or adopt Harness tooling or skills in a repo. Not for reviews or explanations.
---

# Install Harness

## Select

- Domains from actual source/dependencies, never docs mentions: core for TypeScript; Effect, Lit, XState, Shopify app/theme only when used.
- Version: per package README, compatibility policy, release eligibility; must exist in the configured registry, support the consumer's Node/tools. Pin exact. Newest is not compatible.
- No eligible version: report it, install the rest. Never publish/invent a release. Local tarballs only for requested preview adoption. Report versions, config changes, results, omissions by reason.
- The six agentlint plugins peer on the published `@aurelienbbn/agentlint` engine, range per their README; install from npm like any peer. Never substitute unscoped `agentlint`; never install these plugins into the agentlint repo's own gate.
- **Official tooling first:** Effect, Cloudflare, Shopify, PlanetScale, Alchemy, Drizzle: wire [official-tooling](references/official-tooling.md) before any Harness equivalent.

## Merge

- Consumer's package manager. Keep existing ignores/rules. No whole-config replacement, overwriting initializers, or blanket-ignored agent directories.
- Skills requested, in the always-loaded instructions (`AGENTS.md` or host equivalent):
  - copy each always-on file verbatim between its markers: `communication/core.md` between `<!-- harness:communication:start -->` and `<!-- harness:communication:end -->`, `economy/core.md` between `<!-- harness:economy:start -->` and `<!-- harness:economy:end -->`;
  - add a task to skill map for the installed skills (shape of Harness's `AGENTS.md` Skills section);
  - wire conformance-core's `instruction-blocks` check at each `core.md` path, so a skill update fails until the block is recopied.

## Verify

Run the consumer's required checks. Config/dependency failure: fix. Existing-source finding: report; never suppress to go green. Report versions, config changes, results, omissions by reason.

- Install the core package hooks with `harness-install-hooks` from the consumer prepare script; an existing commit-msg hook must chain `harness-check-commit "$1"` explicitly (Windows supported).
- For core, drizzle and effect, merge exported `advisoryRules` into consumer rules: new triage rules stay `warn`; `effect/prefer-effect-array-helpers` stays `error`; statement padding runs only after oxfmt.
