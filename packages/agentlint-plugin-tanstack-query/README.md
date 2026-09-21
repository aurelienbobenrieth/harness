# @aurelienbbn/agentlint-plugin-tanstack-query

Private draft. Development links to the sibling agentlint workspace; packed evidence uses the reviewed local archive; public agentlint 0.1.5 exposes an incompatible API. See the [compatibility evidence](../../docs/compatibility.md#private-draft-boundary).

Custom agentlint rules for TanStack Query projects.

## Presets

- `strictPreset`: enables `query-state-coverage`, `mutation-state-coverage`, and `imperative-query-fetching`.
- `starterPreset`: enables `query-state-coverage` only.
- `query-freshness-intent` is opinionated and belongs to no preset; add `queryFreshnessIntent` to `rules` explicitly.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

- `query-state-coverage`: triggers on `useQuery`, `useQueries`, `useInfiniteQuery`, `useSuspenseQuery`, `useSuspenseQueries` and `useSuspenseInfiniteQuery` calls, with or without explicit type arguments, bare or as the last segment of a member chain (`trpc.todo.list.useQuery(`, `api?.useQuery(`). Suspense hooks are reviewed against their Suspense fallback and resettable error boundary instead of local `isPending` branches. Calls mentioning `enabled` or `skipToken` are reviewed as lazy queries: spinners use `isLoading` or `fetchStatus`, never `isPending`. The review also checks that stale data stays visible after a failed background refetch and that `placeholderData` results are marked with `isPlaceholderData`.
- `mutation-state-coverage`: triggers on bare, generic, and member-chain `useMutation` calls. Review pending feedback, duplicate-submission safety, actionable errors, deliberate retries, success reconciliation, and paused/offline behavior. Tests and test utilities stay silent. This generic interaction contract does not duplicate Shopify's domain-specific form and save-bar reviews.
- `imperative-query-fetching`: triggers on a literal `enabled: false` inside a query options object (one that has `queryKey`/`queryFn`, or is an argument of a query hook or `queryOptions`/`infiniteQueryOptions`), and on `refetch()` / `x.refetch()` / `refetchTodos()` called inside a `useEffect` or `useLayoutEffect` callback in a file that uses a query hook. Apollo-only files and test files stay silent.
- `query-freshness-intent` (opt-in): triggers on `refetchOnWindowFocus`/`refetchOnMount`/`refetchOnReconnect: false` without a non-zero `staleTime` beside them, `gcTime: 0`, and `retry: false|0` inside query options or `defaultOptions.queries`; one finding per options object. Also triggers on `new QueryClient(` in a file with a `"use client"` directive or hydration calls and no `staleTime`. Test files and test utilities stay silent.

## Contract boundaries and migration

UI hooks own visible-state review. Shared `queryOptions` and `infiniteQueryOptions` definitions no longer receive duplicate state-coverage prompts. Suspense hooks are included; pending and error handling can live in surrounding Suspense/error boundaries. The static trigger recognizes the documented hook names, explicit type arguments, and member-call spellings such as tRPC and openapi-react-query; renamed imports and custom wrapper hooks still require consumer fixtures before expansion.

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

## Current rule contract

Rules expose `lifecycle`, `standard` (revision), `detector` (version), and `binding` (id, authority, scope, material options). Presets use arrays of bindings: `defineConfig({ extends: [preset] })` or `defineConfig({ rules: [configuredRule] })`. Configure repeated uses with distinct binding ids. Repository owners choose scope and can raise authority to `human`; defaults permit agent acceptance. Acceptance requires matching current evidence and authority. `@aurelienbbn/agentlint/testing` runs the embedded activation/silence fixtures with the real parser.

## Start with a focused review

The opt-in `starterPreset` includes `queryStateCoverage`. Install a compatible local draft of this package and agentlint, then run:

```sh
agentlint init --preset "@aurelienbbn/agentlint-plugin-tanstack-query#starterPreset"
agentlint rules test
agentlint rules scan --review
agentlint next --format json
```

`init` preserves an existing config and prints the package installation command. It never installs packages itself. Inspect and calibrate the bindings before making `agentlint check --all` required. This gradual onboarding takes conceptual inspiration from desloppify by Peter O'Malley; no code or guidance was copied.

## Credits

The data-first status ordering in `query-state-coverage` and the "inputs belong in the query key" standard of `imperative-query-fetching` take their concept from TkDodo's blog by Dominik Dorfmeister ("Status Checks in React Query", "React Query FAQs") and the TanStack Query guides. `mutation-state-coverage` is independently based on the official TanStack Query mutations guide. Guidance and detectors are independently written; nothing was copied.
