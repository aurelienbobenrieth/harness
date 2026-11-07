---
"@aurelienbbn/oxlint-plugin-tanstack-query": patch
---

`tanstack-query/no-query-cache-mutation` sees an in-place mutation of cached data through a `as`, `satisfies` or `<T>` cast (`(data as Todo[]).sort(...)`), which the rule used to miss.

`tanstack-query/query-fn-returns-value` skips `*.test-d.*` type-test files, where a void `queryFn` is the fixture under test.
