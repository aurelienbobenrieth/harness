# @aurelienbbn/agentlint-plugin-tanstack-query

**4 agentlint reviews for TanStack Query: every query and mutation shows its loading, error and stale states; data is fetched by key, not by command.**

> [!WARNING]
> Requires the engine `@aurelienbbn/agentlint` `>=0.3.0 <0.4.0` as a peer. [Evidence](../../docs/compatibility.md#agentlint-engine).

## Quick start

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-tanstack-query#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` keeps an existing config and prints the install command; never installs. **Calibrate bindings before requiring `agentlint check --all`.**

```ts
import { defineConfig } from "@aurelienbbn/agentlint";
import { queryFreshnessIntent, strictPreset } from "@aurelienbbn/agentlint-plugin-tanstack-query";

export default defineConfig({ extends: [strictPreset], rules: [queryFreshnessIntent] });
```

## Rules

| Rule                        | `strictPreset` | `starterPreset` | Authority | Standard rev | Detector | Skips             |
| --------------------------- | :------------: | :-------------: | --------- | :----------: | :------: | ----------------- |
| `query-state-coverage`      |       ✅       |       ✅        | agent     |     2 ⚠️     |    2     |                   |
| `mutation-state-coverage`   |       ✅       |                 | agent     |      1       |    1     | tests, test utils |
| `imperative-query-fetching` |       ✅       |                 | agent     |      1       |    1     | tests             |
| `query-freshness-intent`    |       🧪       |                 | agent     |      1       |    1     | tests, test utils |

✅ in preset · 🧪 opinionated, add `queryFreshnessIntent` to `rules`. Presets ignore `**/*.d.ts`.

**⚠️ `query-state-coverage` rev 2: UI hooks own the review.** Shared `queryOptions` / `infiniteQueryOptions` no longer get duplicate prompts; Suspense hooks are included, with pending and error handling allowed in surrounding Suspense/error boundaries.

```ts
trpc.todo.list.useQuery(undefined); // ❌ query-state-coverage
queryOptions({ queryKey, queryFn }); // ✅ shared options, no duplicate prompt
trpc.todo.save.useMutation(); // ❌ mutation-state-coverage
React.useEffect(() => {
  todos.refetch();
}, [filter]); // ❌ imperative-query-fetching
useQuery({ queryKey: ["user", id], queryFn, enabled: Boolean(id) }); // ✅ input in the key
queryOptions({ queryKey, queryFn, staleTime: 0, refetchOnMount: false }); // ❌ query-freshness-intent
```

Recognized: documented hook names, explicit type arguments, member calls (tRPC, openapi-react-query). **Not yet:** renamed imports and custom wrapper hooks; they need consumer fixtures first.

<details>
<summary><code>query-state-coverage</code>: hooks and review checks</summary>

```ts
useQuery<Array<Todo>, Error>({ queryKey: ["items"] }); // ❌ fires
api?.useQuery("get", "/todos"); // ❌ fires: optional chain
const { data } = useSuspenseQuery(todosOptions); // ❌ fires: reviewed against Suspense + error boundary
prefetchQuery({ queryKey: ["items"] }); // ✅ silent
myUseQuery({});
trpc.todo.useQueryState(); // ✅ silent: not a hook name
```

Hooks: `useQuery`, `useQueries`, `useInfiniteQuery`, `useSuspenseQuery`, `useSuspenseQueries`, `useSuspenseInfiniteQuery`, with or without type arguments, bare or as the last segment of a member chain.

| Case                                   | Review checks                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Suspense hooks                         | the Suspense fallback and a resettable error boundary, not local `isPending` branches |
| call mentions `enabled` or `skipToken` | lazy query: spinners use `isLoading` or `fetchStatus`, never `isPending`              |
| every query                            | stale data stays visible after a failed background refetch                            |
| `placeholderData`                      | results are marked with `isPlaceholderData`                                           |

</details>

<details>
<summary><code>mutation-state-coverage</code>: six states per mutation</summary>

Fires on bare, generic and member-chain `useMutation` calls (`useMutation<Todo, Error, Input>(…)`). Silent: `useMutationState`, custom wrappers like `useSaveMutation()`.

```text
pending feedback · duplicate-submission safety · actionable errors
deliberate retries · success reconciliation · paused/offline behavior
```

Generic interaction contract; does not duplicate Shopify's form and save-bar reviews.

</details>

<details>
<summary><code>imperative-query-fetching</code>: inputs belong in the query key</summary>

```ts
useQuery({ queryKey: ["search"], queryFn: () => search(term), enabled: false }); // ❌ fires
trpc.user.byId.useQuery(id, { enabled: false }); // ❌ fires
const onClick = () => {
  void refetch();
}; // ✅ silent: event handler
export const flag = { name: "beta", enabled: false }; // ✅ silent: not query options
```

| Fires on                                     | Where                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| literal `enabled: false`                     | a query options object: has `queryKey`/`queryFn`, or is an argument of a query hook or `queryOptions`/`infiniteQueryOptions` |
| `refetch()`, `x.refetch()`, `refetchTodos()` | inside a `useEffect` / `useLayoutEffect` callback, in a file that uses a query hook                                          |

Apollo-only files stay silent.

</details>

<details>
<summary><code>query-freshness-intent</code> 🧪: switching off freshness needs a reason</summary>

One finding per options object, inside query options or `defaultOptions.queries`:

| Fires on                                                                            | Stays silent                                                     |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `refetchOnWindowFocus` / `refetchOnMount` / `refetchOnReconnect: false`             | a non-zero `staleTime` beside it                                 |
| `gcTime: 0`                                                                         |                                                                  |
| `retry: false` or `retry: 0`                                                        | `retry` outside query options (`upload(file, { retry: false })`) |
| `new QueryClient(` in a file with `"use client"` or hydration calls, no `staleTime` | a plain `new QueryClient()` elsewhere                            |

```ts
queryOptions({ queryKey, queryFn, refetchOnMount: "always", retry: 2 }); // ✅ silent
```

</details>

<details>
<summary>Agentlint rule contract</summary>

| Fact                | Detail                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| rule shape          | `lifecycle`, `standard` (revision), `detector` (version), `binding` (id, authority, scope, material options)                  |
| composing           | `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`; repeated uses need distinct binding ids |
| authority           | defaults permit agent acceptance; repository owners choose scope and can raise authority to `human`                           |
| accepting a finding | requires matching current evidence **and** authority                                                                          |
| fixtures            | `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser                           |

</details>

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                  | Trigger or review scope                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imperative-query-fetching` | Flags queries fetched by command: a literal `enabled: false` in query options, or `refetch()` called from an effect.                                                                                            |
| `mutation-state-coverage`   | Flags useMutation calls, including member-call spellings, that need user-visible pending, error, retry, success, and duplicate-submission review.                                                               |
| `query-freshness-intent`    | Flags switched-off refetch triggers, retries, or cache time (`refetchOn*: false`, `retry: false\|0`, `gcTime: 0`) and server-rendered QueryClients without a `staleTime`, which need a stated freshness intent. |
| `query-state-coverage`      | Flags TanStack Query hook calls (useQuery, useQueries, useInfiniteQuery and their suspense variants, including generic and member-call spellings) that need visible-state coverage.                             |

### Credited concepts

- TanStack Query mutations guide (documentation inspiration; independently implemented)
- TkDodo's blog, "React Query FAQs" by Dominik Dorfmeister (concept: inputs belong in the query key, not in refetch; independently worded)
- TkDodo's blog, "Status Checks in React Query" by Dominik Dorfmeister (concept: data-first status ordering, independently worded)

<!-- harness-catalog:end -->

## Credits

Guidance and detectors are independently written; nothing copied.

| Rule                        | Concept source                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `query-state-coverage`      | data-first status ordering: TkDodo's blog by Dominik Dorfmeister, "Status Checks in React Query", and the TanStack Query guides |
| `imperative-query-fetching` | "inputs belong in the query key": TkDodo's blog, "React Query FAQs", and the TanStack Query guides                              |
| `mutation-state-coverage`   | the official TanStack Query mutations guide                                                                                     |
| `starterPreset` onboarding  | desloppify by Peter O'Malley: conceptual inspiration, no code or guidance copied                                                |
