---
"@aurelienbbn/agentlint-plugin-tanstack-query": minor
---

`tanstack-query/query-state-coverage` stays silent when the function around a `useQuery`, `useQueries`, or `useInfiniteQuery` call already handles both states (`isPending` / `isLoading` / `status === "pending"` and `isError` / `error` / `status === "error"`). Of 162 hook calls in the TanStack examples, 119 sat in such a function. Suspense hooks still report. Detector version 3.
