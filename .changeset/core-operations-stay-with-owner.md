---
"@aurelienbbn/agentlint-plugin-core": minor
---

Adds `core/operations-stay-with-owner` to `strictPreset`: a file that calls 4 or more operations (lowercase value exports) of one other module through its public entry (`api.ts` by default, `entryPattern`; bare specifiers listed in `packages`) is reported for review, agent authority. Code that drives another module's model belongs to that module: move it there, or have the owner offer the one outcome the file needs. Types and PascalCase vocabulary never count; operations are counted per file and per owner. Options: `minOperations`, `entryPattern`, `packages`.
