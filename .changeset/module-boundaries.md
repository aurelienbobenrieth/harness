---
"@aurelienbbn/oxlint-plugin-core": minor
---

Add `core/module-boundaries`, off until enabled: inside one workspace member, it imports other units of the source root through a `#` subpath and the own unit by relative path (autofixed both ways from the package.json `imports` pattern, keeping `?query` suffixes), and reports configured forbidden edges and imports of another unit's private paths. Options: `sourceRoot`, `units`, `forbidden`, `private`, `includeTestFiles`.
