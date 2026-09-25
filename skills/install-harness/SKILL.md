---
name: install-harness
description: Add Harness lint, format, conformance packages, and skills to a consumer project, matched to its actual stack and pinned to verified versions. Use when the user asks to install, set up, or adopt Harness tooling or skills in a repo. Not for reviews or explanations.
---

# Install Harness

## Select

- Domains from actual source and dependencies, never docs mentions: core for TypeScript; Effect, Lit, XState, Shopify app/theme only when used. Conformance also needs its project inputs.
- Version: per package README, compatibility policy, release eligibility; must exist in the configured registry and support the consumer's Node and tools. Pin exact. Newest ≠ compatible.
- No eligible version → report it, install the rest. Never publish or invent a release. Local tarballs only for requested preview adoption.
- The five agentlint plugins peer on the published `@aurelienbbn/agentlint` engine in the range their README states; install it from npm like any peer. Never substitute the unscoped `agentlint` package, and never install these plugins into the agentlint repo's own gate: they would check the engine with an older release of itself.

- **Official tooling first:** for Effect, Cloudflare, Shopify, PlanetScale, Alchemy, or Drizzle, wire what [official-tooling](references/official-tooling.md) lists before any Harness equivalent.

## Merge

- Use the consumer's package manager. Keep existing ignores and rules. No whole-config replacement, overwriting initializers, or blanket-ignored agent directories.
- Wire from documented exports; don't assume helpers, peers, or commands across tool versions.
- Trial new policies on real source before making them blocking.
- Skills requested → add to always-loaded instructions (`AGENTS.md`, `CLAUDE.md`, or equivalent) one line to read the installed communication skill before the first reply, plus a task → skill map for the installed skills (copy the shape of Harness's `AGENTS.md` Skills section). Skills stay discoverable; only the map and communication are bootstrapped.

## Verify

- Run the consumer's required checks. Config/dependency failure → fix. Existing-source finding → report; never suppress to go green.
- Report versions, config changes, results, omissions by reason.
