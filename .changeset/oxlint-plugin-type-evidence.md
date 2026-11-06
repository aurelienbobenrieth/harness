---
"@aurelienbbn/oxlint-plugin-type-evidence": patch
---

All ten rules skip test files (`*.test.*`, `*.spec.*`, `__tests__`, `__mocks__`, `test(s)/`, `e2e/`), where assertion-built doubles and deliberately invalid inputs are the subject. `no-widen-then-assert` no longer reports `return out as T` when `T` is the enclosing function's type parameter.
