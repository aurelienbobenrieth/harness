---
"@aurelienbbn/conformance-core": minor
---

Add the stack-agnostic quality conformance package with four checks: dependency-overlap (one package per known-duplicate family, workspace-aware, custom families via dependencyOverlapGroups), duplication-budget (jscpd clone budget, warning when jscpd is absent), dead-exports (knip unused files/exports, warning when knip is absent, requireKnipConfig gate), and closed-design-system-probe (config-gated CSS build asserting required token selectors are present and default utilities do not leak). All configurable via ConformanceRunOptions, with skipChecks, a runQualityConformance runner, and a /vitest adapter.
