# @aurelienbbn/oxlint-plugin-tanstack-query

**8 oxlint rules for TanStack Query v5 bugs that compile, type-check, stay silent in production, and slip past `@tanstack/eslint-plugin-query`.**

**Never re-implements an official rule.** Load the official plugin alongside via `jsPlugins`, or let `withTanstackQueryLayer` from `@aurelienbbn/oxlint-config` wire both via `companionPlugins`.

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

Peer: oxlint >=1.82.0 <2.0.0. No preset. **No autofix:** each rewrite depends on the data and the component.

```text
everywhere  ██████   6
opt-in      ██       2   no-query-data-sync-effect (borderline for form drafts) · test-query-client-hygiene (test files only)
```

## 🚨 Failures must reach the query

```ts
queryFn: async () => {
  try {
    return await api.getTodos();
  } catch (error) {
    console.error(error);
  }
}; // ❌ swallowed
queryFn: () => api.getTodos().catch(() => []); // ❌ returned .catch that never throws
queryFn: () => fetch("/api/todos").then((response) => response.json()); // ❌ no status check
queryFn: async () => {
  const response = await fetch("/api/todos");
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}; // ✅
```

Typed ESLint? Use the official `no-void-query-fn` instead of `query-fn-returns-value`.

<details>
<summary>Exact triggers and silent cases</summary>

```ts
queryFn: async () => {
  try {
    return await api.getTodo();
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}; // ✅ conditional rethrow
queryFn: async () => parseResponse(await fetch("/api/a")); // ✅ handed to another function
```

| Rule                                     | ❌ Fires on                                                                                                                                                                                                                                                           | ⏭️ Silent on                                                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-swallowed-query-fn-error`            | a `queryFn` / `mutationFn` whose own `try` decides the result (returns, assigns an outer variable, or is the last statement) while `catch` never throws or returns `Promise.reject(...)`; a returned, awaited or chained `.catch(handler)` whose handler never throws | conditional rethrow; guards around side effects; detached `void promise.catch(...)`                                                                                                 |
| `require-fetch-status-check-in-query-fn` | global `fetch` (also `window.`, `globalThis.`, `self.`) in a `queryFn` / `mutationFn` with no `.ok` / `.status` read, no `{ ok }` / `{ status }` destructuring, no `throw`                                                                                            | response handed on (`parse(await fetch(...))`, `.then(handleResponse)`, `decode(response)`); shadowed or imported `fetch`; clients that throw by default (`ky`, `axios`, `api.get`) |
| `query-fn-returns-value`                 | a block-bodied `queryFn` with no `return <value>` not ending in `throw`; every `return;`, `return undefined`, `return void ...`                                                                                                                                       | expression-bodied arrows; `mutationFn`                                                                                                                                              |

</details>

## 🧊 The cache is immutable

```ts
queryClient.setQueryData(["todos"], (old: Todo[]) => {
  old.push(todo);
  return old;
}); // ❌ mutated in place
queryClient.setQueryData(["todos"], (old: Todo[] | undefined) => [...(old ?? []), todo]); // ✅ copy
```

**Blind spot: aliases of the cached value aren't tracked.**

<details>
<summary>What <code>no-query-cache-mutation</code> watches</summary>

Watched: first parameter of a `setQueryData` / `setQueriesData` updater, first parameter of a query `select`, a variable initialised from `getQueryData(...)`. `select` counts next to `queryKey` / `queryFn`, or as a direct option of an imported query hook or `queryOptions` / `infiniteQueryOptions`.

Mutations: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`, member assignment, `++` / `--`, `delete`, `Object.assign(value, ...)`. Copies and immer drafts (different bindings) pass.

</details>

## 🔁 Optimistic updates need cancel + settle

```ts
useMutation({
  mutationFn: addTodo,
  onMutate: (todo: Todo) => {
    queryClient.setQueryData(["todos"], (old: Todo[]) => [...old, todo]); // ❌ no cancel* call, no onError / onSettled
  },
});
useMutation({
  mutationFn: addTodo,
  onMutate: async (todo: Todo) => {
    await queryClient.cancelQueries({ queryKey: ["todos"] });
    queryClient.setQueryData(["todos"], (old: Todo[]) => [...old, todo]);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["todos"] }), // ✅ onSettled alone is enough
});
```

<details>
<summary>What <code>require-optimistic-update-guards</code> checks</summary>

An `onMutate` (next to `mutationFn`, or an option of imported `useMutation` / `mutationOptions`) calling `setQueryData` / `setQueriesData`:

| Report               | When                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| missing cancellation | the handler calls nothing whose name contains `cancel`                                  |
| missing settlement   | neither `onError` nor `onSettled` in the options. ⏭️ Skipped if the object has a spread |

</details>

## ⚛️ Server state isn't component state

```ts
const { data } = useQuery(todosOptions);
const [todos, setTodos] = useState(data); // ❌ no-query-data-in-use-state: frozen at first render
useEffect(() => {
  if (data) setTodos(data);
}, [data]); // ❌ no-query-data-sync-effect (opt-in)
```

Fix: derive during render or split the component.

<details>
<summary>Exact triggers and exemptions</summary>

| Rule                         | ❌ Fires on                                                                                                                                                                                                                                         | ⏭️ Exempt                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `no-query-data-in-use-state` | `useState(initial)` (React or Preact, aliases and `React.useState` included) where `initial` reads `data` from `useQuery` / `useInfiniteQuery` / `useQueries` imported from TanStack Query: destructured `data` (alias or default) or `result.data` | suspense hooks; queries with a literal `initialData` (data defined on first render) |
| `no-query-data-sync-effect`  | a `useEffect` / `useLayoutEffect` callback passing the same query data to a `useState` setter                                                                                                                                                       | enable deliberately: initialising a form draft is a known borderline case           |

</details>

## 🧪 One fresh QueryClient per test

```ts
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }); // ❌ module scope
```

<details>
<summary><code>test-query-client-hygiene</code> triggers and <code>testFilePattern</code></summary>

`new QueryClient(...)` imported from TanStack Query, in files matching `testFilePattern`:

| ❌ Report                                                           | ⏭️ Unless                                           |
| ------------------------------------------------------------------- | --------------------------------------------------- |
| client created at module scope or directly in a `describe` callback | that variable is `.clear()`ed somewhere in the file |
| client without an explicit `defaultOptions.queries.retry`           | options are non-literal or spread (not judged)      |

| Option            | Default                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `testFilePattern` | `(?:\.(?:test\|spec)\.[cm]?[jt]sx?$)\|(?:/__tests__/)` → `*.test.*`, `*.spec.*`, `__tests__/`. Widen it to cover test utilities |

</details>

## Contract

| Topic           | Contract                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| file gate       | rules keyed on option names (`queryFn`, `mutationFn`, `select`, `onMutate`, `setQueryData`) run only in files importing `@tanstack/query-core` or an `@tanstack/*-query` adapter |
| bindings        | hooks, option helpers, `QueryClient` resolve through those imports: aliases, namespace imports, lexical shadows                                                                  |
| indirection     | `queryFn`, `mutationFn`, `onMutate` resolve one hop to a same-file function declaration or `const` function                                                                      |
| ❌ out of scope | wrapper hooks re-exported from project modules                                                                                                                                   |
| analysis        | syntactic, per file                                                                                                                                                              |

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
