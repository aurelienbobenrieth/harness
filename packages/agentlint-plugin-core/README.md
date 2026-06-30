# @aurelienbbn/agentlint-plugin-core

Custom agentlint rules for general TypeScript projects.

## Presets

- `strictPreset`: enables all core rules in this package.

## Rules

- `core/bounded-data-access`: require repository-like list/search/query calls to show an explicit result bound.
- `core/bounded-work`: require I/O-heavy paths and long budgets to show explicit boundedness.
