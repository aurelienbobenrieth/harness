---
"@aurelienbbn/conformance-core": minor
---

Add the opt-in `tsconfig-strictness` check. It resolves each tsconfig through its `extends` chain (relative, extensionless, array and package-specifier extends; JSONC comments and trailing commas) and fails unless `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and `erasableSyntaxOnly` resolve to `true`, no strict-family flag is switched off, and `ignoreDeprecations` is absent. `tsconfigStrictness.files` selects the configs, `additionalRequiredFlags` extends the baseline, and `waivers` downgrades a flag to a warning that carries its written reason. Unresolvable configs are failed evaluations. The check is skipped until `tsconfigStrictness` is set (`{}` enables the defaults), so existing consumers keep their current result; `coreChecks` now lists five checks and reports contain a fifth entry.
