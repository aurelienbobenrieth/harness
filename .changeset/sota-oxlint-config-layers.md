---
"@aurelienbbn/oxlint-config": minor
---

Pin `vitest/require-to-throw-message` and `vitest/prefer-called-with` by name in the test-file override, and configure `vitest/valid-title` with the exported `vagueTestTitlePattern` (titles that are only "works" / "should work", or that contain "correctly", "properly" or "as expected"). Add two opt-in helpers: `layerDirectionOverride({ files, forbidden, message })`, which builds an `overrides` entry on `eslint/no-restricted-imports` `patterns` for a declared layer, and `withImportGraphLayer(config)`, which loads the `import` plugin with only `import/no-cycle` and `import/no-self-import` on and every other `import/*` rule of oxlint 1.82.0 pinned off through the exported `importGraphRules`.

Migration: test titles matching `vagueTestTitlePattern` now fail; name the behavior instead. After an oxlint upgrade, compare `oxlint --rules` with `importGraphRules` and pin any new `import/*` rule to `off`.
