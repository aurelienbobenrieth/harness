---
name: install-harness
description: Install Harness lint, format, or conformance packages into a consumer project when the user asks for tooling setup. Not for reviews or explanations.
---

# Install Harness

## Select

- Domains from actual source and dependencies, never docs mentions: core for TypeScript; Effect, Lit, XState, Shopify app/theme only when used. Conformance also needs its project inputs.
- Version: per package README, compatibility policy, release eligibility; must exist in the configured registry and support the consumer's Node and tools. Pin exact. Newest ≠ compatible.
- No eligible version → report it, install the rest. Never publish or invent a release. Local tarballs only for requested preview adoption.
- The five agentlint plugins target the checked-in agentlint archive, whose API differs from public npm `agentlint` at the same version. Never substitute the public package. Preview = explicit local setup, reviewed artifacts, verified integrity.

## Merge

- Use the consumer's package manager. Keep existing ignores and rules. No whole-config replacement, overwriting initializers, or blanket-ignored agent directories.
- Wire from documented exports; don't assume helpers, peers, or commands across tool versions.
- Trial new policies on real source before making them blocking.
- Skills requested → add one line to always-loaded instructions (`AGENTS.md`, `CLAUDE.md`, or equivalent): read the installed communication skill before the first reply. Other skills stay discoverable, not bootstrapped.

## Verify

- Run the consumer's required checks. Config/dependency failure → fix. Existing-source finding → report; never suppress to go green.
- Report versions, config changes, results, omissions by reason.
