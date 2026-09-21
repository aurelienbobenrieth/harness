---
"@aurelienbbn/oxlint-plugin-effect": minor
---

Add 8 steering rules: nondeterminism hygiene (no-ambient-nondeterminism), Match adoption (no-switch, prefer-match), service discipline (no-service-constructor-imports, no-service-option, no-static-service-forwarders), and layer-composition shape (no-nested-layer-provide, no-cascading-layer-provide). The nondeterminism and Match rules only fire in files importing from effect, so the plugin stays safe on mixed repos.
