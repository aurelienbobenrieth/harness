# @aurelienbbn/agentlint-plugin-core

Custom agentlint review rules for general TypeScript projects.

## Presets

- `strictPreset`: enables all core review rules in this package.

## Rules

- `core/bounded-data-access`: review repository-like list/search/query calls that do not show an explicit bound.
- `core/bounded-work-review`: review sequential I/O, looped I/O, fan-out, and long runtime budgets.
