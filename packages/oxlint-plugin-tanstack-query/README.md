# @aurelienbbn/oxlint-plugin-tanstack-query

Custom oxlint rules for TanStack Query v5. The plugin covers failure modes that compile, type-check and stay silent in production, and that `@tanstack/eslint-plugin-query` does not report. It never re-implements an official rule: load the official plugin next to this one through oxlint `jsPlugins`.

Private draft: the package is versioned and tested in this repository but not a release candidate.

## Usage

```json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-tanstack-query"],
  "rules": {
    "tanstack-query/no-swallowed-query-fn-error": "error",
    "tanstack-query/require-fetch-status-check-in-query-fn": "error",
    "tanstack-query/no-query-cache-mutation": "error",
    "tanstack-query/require-optimistic-update-guards": "error",
    "tanstack-query/no-query-data-in-use-state": "error",
    "tanstack-query/query-fn-returns-value": "error"
  },
  "overrides": [
    {
      "files": ["**/*.{test,spec}.*"],
      "rules": { "tanstack-query/test-query-client-hygiene": "error" }
    }
  ]
}
```

The plugin ships no preset; every rule is enabled by name.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for the one-line contracts. None of the rules has an autofix: each correct rewrite depends on the data and the component.

- `no-swallowed-query-fn-error`: triggers on a `queryFn` / `mutationFn` whose own `try` block decides the result (it returns, assigns an outer variable, or is the last statement) while the `catch` block never throws or returns `Promise.reject(...)`, and on a returned, awaited or chained `.catch(handler)` whose handler never throws. A conditional rethrow passes. Guards around side effects and detached `void promise.catch(...)` statements are ignored.
- `require-fetch-status-check-in-query-fn`: triggers on a call to the global `fetch` (also `window.`, `globalThis.`, `self.`) inside a `queryFn` / `mutationFn` that contains no `.ok` / `.status` read, no `{ ok }` / `{ status }` destructuring and no `throw`. Silent when the response is handed to another function (`parse(await fetch(...))`, `.then(handleResponse)`, `decode(response)`), for a shadowed or imported `fetch`, and for clients that throw by default (`ky`, `axios`, `api.get`).
- `no-query-cache-mutation`: triggers when the first parameter of a `setQueryData` / `setQueriesData` updater, the first parameter of a query `select`, or a variable initialised from `getQueryData(...)` is mutated in place: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`, member assignment, `++` / `--`, `delete`, or `Object.assign(value, ...)`. `select` is recognised next to `queryKey` / `queryFn` or as a direct option of an imported query hook or `queryOptions` / `infiniteQueryOptions`. Copies and immer drafts are different bindings and pass; aliases of the cached value are not tracked.
- `require-optimistic-update-guards`: triggers on an `onMutate` handler (next to `mutationFn`, or an option of imported `useMutation` / `mutationOptions`) that calls `setQueryData` / `setQueriesData`. Reports a missing cancellation when the handler calls nothing whose name contains `cancel`, and a missing settlement when the same options object has neither `onError` nor `onSettled`. `onSettled` alone is enough. The settlement check is skipped when the options object contains a spread.
- `no-query-data-in-use-state`: triggers on `useState(initial)` (React or Preact, aliases and `React.useState` included) when `initial` reads `data` from `useQuery`, `useInfiniteQuery` or `useQueries` imported from a TanStack Query package: destructured `data` with alias or default, or `result.data`. Suspense hooks and queries with a literal `initialData` are exempt because their data is defined on first render.
- `query-fn-returns-value`: triggers on a block-bodied `queryFn` with no `return <value>` that does not end in a `throw`, and on every `return;`, `return undefined` or `return void ...` in a `queryFn`. Expression-bodied arrows and `mutationFn` are never reported. Use the official `no-void-query-fn` instead when linting with type information under ESLint.
- `no-query-data-sync-effect` (opt-in): triggers on a `useEffect` / `useLayoutEffect` callback that passes the same query data to a `useState` setter. Initialising a form draft this way is a known borderline case, so enable it deliberately; the recommended fix is still to derive during render or split the component.
- `test-query-client-hygiene` (opt-in, test files only): triggers on `new QueryClient(...)` imported from a TanStack Query package in files matching `testFilePattern` (default: `*.test.*`, `*.spec.*`, `__tests__/`). Reports a client created at module scope or directly in a `describe` callback unless that variable is `.clear()`ed somewhere in the file, and a client created without an explicit `defaultOptions.queries.retry`. Non-literal or spread options are not judged. Set `testFilePattern` to include test utilities.

`queryFn`, `mutationFn` and `onMutate` values are resolved one hop to a same-file function declaration or `const` function.

## Contract boundaries

Rules that match option names (`queryFn`, `mutationFn`, `select`, `onMutate`, `setQueryData`) only run in files that import from `@tanstack/query-core` or an `@tanstack/*-query` adapter; rules that match hooks, option helpers or `QueryClient` resolve the binding through those imports, including aliases, namespace imports and lexical shadows. Wrapper hooks re-exported from project modules are outside the contract. All checks are syntactic and per file.

## Credits

Concepts are credited to the TanStack Query guides (Query Functions, Updates from Mutation Responses, Optimistic Updates, Testing), to Dominik Dorfmeister's tkdodo.eu articles (React Query FAQs, React Query Error Handling, Practical React Query, React Query and Forms, Breaking React Query's API on purpose, Concurrent Optimistic Updates in React Query, Testing React Query), and to the `no-void-query-fn` rule of `@tanstack/eslint-plugin-query`. Every rule is an independent implementation.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                               | Trigger or review scope                                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `no-query-cache-mutation`                | Disallow mutating cached query data in place inside setQueryData/setQueriesData updaters, select functions, and getQueryData results.     |
| `no-query-data-in-use-state`             | Disallow passing useQuery/useInfiniteQuery/useQueries data to useState as its initial value; suspense queries and initialData are exempt. |
| `no-query-data-sync-effect`              | Disallow useEffect/useLayoutEffect callbacks that pass useQuery/useInfiniteQuery/useQueries data to a useState setter.                    |
| `no-swallowed-query-fn-error`            | Disallow queryFn/mutationFn bodies that catch a failure without rethrowing, which turns errors into successful undefined data.            |
| `query-fn-returns-value`                 | Require block-bodied queryFn functions to return a value: no missing return, bare return, or return undefined.                            |
| `require-fetch-status-check-in-query-fn` | Require queryFn/mutationFn bodies that call global fetch to check response.ok or response.status and throw on failure.                    |
| `require-optimistic-update-guards`       | Require onMutate handlers that write to the query cache to call cancelQueries first and to pair with onError or onSettled.                |
| `test-query-client-hygiene`              | Require test files to create a QueryClient per test and to set defaultOptions.queries.retry explicitly.                                   |

### Credited concepts

- "Breaking React Query's API on purpose" and "React Query and Forms" by Dominik Dorfmeister, tkdodo.eu (concept)
- "Practical React Query" and "React Query and Forms" by Dominik Dorfmeister, tkdodo.eu (concept)
- "React Query FAQs" by Dominik Dorfmeister, tkdodo.eu (concept)
- @tanstack/eslint-plugin-query no-void-query-fn (concept)
- TanStack Query "Optimistic Updates" guide and "Concurrent Optimistic Updates in React Query" by Dominik Dorfmeister, tkdodo.eu (concept)
- TanStack Query "Query Functions" guide and "React Query Error Handling" by Dominik Dorfmeister, tkdodo.eu (concept)
- TanStack Query "Testing" guide and "Testing React Query" by Dominik Dorfmeister, tkdodo.eu (concept)
- TanStack Query "Updates from Mutation Responses" guide, Immutability section (concept)

<!-- harness-catalog:end -->
