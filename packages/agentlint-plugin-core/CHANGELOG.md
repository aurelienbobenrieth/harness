# @aurelienbbn/agentlint-plugin-core

## 0.3.1

### Patch Changes

- [#97](https://github.com/aurelienbobenrieth/harness/pull/97) [`754d98c`](https://github.com/aurelienbobenrieth/harness/commit/754d98c10480b77c654c88a412636d7ba80cffea) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Accept agentlint 0.9 (`>=0.3.0 <0.10.0`) and oxfmt 0.78 (`>=0.67.0 <0.69.0 || ^0.74.0 || ^0.78.0`) as peers. Update runtime dependencies to `@oxlint/plugins` 1.93.0, `graphql` 17.1.0 and `parse5` 8.1.1. The current consumer profile is verified with agentlint 0.9.1, oxlint 1.93.0, oxlint-tsgolint 7.0.2006, oxfmt 0.78.0, Vite Plus 1.5.1 and Vitest 5.1.0.

## 0.3.0

### Minor Changes

- [#92](https://github.com/aurelienbobenrieth/harness/pull/92) [`0621814`](https://github.com/aurelienbobenrieth/harness/commit/0621814cb10243be6f770408b4fd114498c75a41) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Tighten core reviews that were noisy or lossy on real repositories, and move one out of the strict preset.

  - `bounded-work` no longer scans test files, `testing.*` helpers or `*.e2e.*` suites: the test runner owns their timeout, and tests were 48% of its findings on two consumers. Its binding digest changes, so existing acceptances of test-file findings are pruned.
  - `bounded-data-access` reports the call whose callee is the unbounded method (not every enclosing call that contains one), accepts only a caller-supplied bound (a SQL placeholder or interpolation such as `LIMIT ?`, `LIMIT $1`, `LIMIT :limit`, `LIMIT ${n}`, or a non-literal `.limit(x)` / `take: x`; a hard-coded `LIMIT 100` or `take: 10` no longer satisfies the rule, and the message asks to expose limit and cursor in the function contract), treats `.query(` as data access only with a SQL string (not an RPC, tRPC or DOM `query`), skips `store.select(fn)` selector calls, and skips test files. It fired 611 times on one consumer (wrappers, SQL with a `LIMIT`, RPC client atoms) and 1444 times on tRPC, nearly all test calls of `client.x.query()`.
  - `test-expectation-drift` now sees an expectation written on the same line as `it(...)`. Loosening `toStrictEqual` to `toMatchObject`, or re-valuing an expectation, inside `it("x", () => expect(...))` was invisible.
  - `single-use-extraction-review` and `precision-boundary-review` give repeated finding keys an ordinal suffix. Two same-named helpers (or two same-unit expressions on one line, as in minified bundles) made the engine abort the whole `agentlint check` with `reported a duplicate finding key`.
  - `boundary-resilience` no longer reads a variable named `got` (the got/want test idiom, `got.fill(0)`) as the `got` HTTP client; the default pattern matches `fetch(`, `axios|got|ky(` and their HTTP verb methods.
  - `expected-value-recomputed` leaves `strictPreset` and stays exported as opt-in: all 13 accepted findings on two consumers were deliberate law tests (copy equals original, sorted order, differential, determinism), none a mirrored formula.
  - Remove `abstraction-earns-keep`: across two applications, hono and tRPC, 43 findings held about 5 plausible needless aliases (about 12%); the rest were named predicates over a builtin, test helpers, zero-parameter thunks, typed facades and consumer-owned ports (all 6 header-interface findings), and all 21 ledger entries were kept with no code change. Drop it from `strictPreset` and the exports (`abstractionEarnsKeep`, `defineAbstractionEarnsKeep`).
  - `bounded-work` looped-I/O detection is now structural: an `await` or I/O call must sit inside a loop body or an iteration callback (`map`, `forEach`, `flatMap`, `reduce`), not merely share a function with a loop. Its detector version moves to 2.
  - Remove `operations-stay-with-owner` (exports `operationsStayWithOwner`, `defineOperationsStayWithOwner`, `strictPreset` entry). Its module entry was one project's `api.ts` convention; generalised to directory indexes and workspace packages it found no needless orchestration on one application (0), hono (3 barrel re-exports) or tRPC (8 example client configs, 1 adapter), and the other application's 21 `api.ts` hits were all layer or RPC composition roots, which the rule's own standard passes.

  The package no longer depends on `oxc-parser`: only the removed `abstraction-earns-keep` used it.

## 0.2.3

### Patch Changes

- [#75](https://github.com/aurelienbobenrieth/harness/pull/75) [`666c4cc`](https://github.com/aurelienbobenrieth/harness/commit/666c4cc20f6e9f350a1a0df7259521e988be9d4e) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Update runtime dependencies to `@oxlint/plugins` 1.88.0, `oxc-parser` 0.154.0, `postcss` 8.5.30 and `smol-toml` 1.9.1. Accept agentlint 0.8 alongside the existing supported engine versions (`>=0.3.0 <0.9.0`). Keep baseline tools pinned and exercise the current consumer profile with agentlint 0.8.0, oxlint 1.88.0, oxlint-tsgolint 7.0.2004, Vitest 5.0.4 and Stylelint 17.16.0.

## 0.2.2

### Patch Changes

- [#67](https://github.com/aurelienbobenrieth/harness/pull/67) [`b8a59d5`](https://github.com/aurelienbobenrieth/harness/commit/b8a59d5f28c0f63cbbf8afddd928977489a40613) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Extend the declared agentlint peer range to >=0.3.0 <0.8.0 and exercise the published 0.7.0 engine in the current packed-consumer compatibility profile. Keep development and the baseline consumer on 0.3.0.

## 0.2.1

### Patch Changes

- [#65](https://github.com/aurelienbobenrieth/harness/pull/65) [`0ab6264`](https://github.com/aurelienbobenrieth/harness/commit/0ab6264383c69821f91b72d9eb7fa2876589bfb5) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Use structural forwarding checks for abstraction-earns-keep so calculations, argument transformations and private collaborator accessors do not become delegation findings. Detect transparent expression arrows consistently with function declarations.

  Use object-creating annotated factories as additional implementation evidence without flagging their own return contracts. Recognize derived interfaces and direct/intersection aliases. Add implementationFiles for symbol-aware cross-file evidence from declared source snapshots, including relative import aliases, namespace imports and re-exports. Keep ambiguous architectural findings under human authority and increment the detector version to invalidate obsolete judgments.

## 0.2.0

### Minor Changes

- [#58](https://github.com/aurelienbobenrieth/harness/pull/58) [`0a017b4`](https://github.com/aurelienbobenrieth/harness/commit/0a017b448b3d4405c0201e99278366b5727f3098) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Adds `core/operations-stay-with-owner` to `strictPreset`: a file that calls 4 or more operations (lowercase value exports) of one other module through its public entry (`api.ts` by default, `entryPattern`; bare specifiers listed in `packages`) is reported for review, agent authority. Code that drives another module's model belongs to that module: move it there, or have the owner offer the one outcome the file needs. Types and PascalCase vocabulary never count; operations are counted per file and per owner. Options: `minOperations`, `entryPattern`, `packages`.

## 0.1.3

### Patch Changes

- [#45](https://github.com/aurelienbobenrieth/harness/pull/45) [`d88074c`](https://github.com/aurelienbobenrieth/harness/commit/d88074c85ff18543527be6d1fd7d798c4b26b7fb) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - docs: the README states the agentlint peer range the package declares, `>=0.3.0 <0.5.0`.

## 0.1.2

### Patch Changes

- [#41](https://github.com/aurelienbobenrieth/harness/pull/41) [`d073fdc`](https://github.com/aurelienbobenrieth/harness/commit/d073fdc61bc9cfc9d0cbded23286fa82af00f685) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - The agentlint plugins accept `@aurelienbbn/agentlint` 0.4 as a peer (`>=0.3.0 <0.5.0`), whose TSX grammar parses a `&` inside a JSX string attribute such as Tailwind's `className="[&_svg]:size-4"`. The compatibility `current` profile now tests agentlint 0.4.0.

## 0.1.1

### Patch Changes

- [#21](https://github.com/aurelienbobenrieth/harness/pull/21) [`f553d48`](https://github.com/aurelienbobenrieth/harness/commit/f553d4874fc4c6d611b80b93136c718910856d17) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Publish npm keywords, homepage, author, the changelog, and README badges.

## 0.1.0

### Minor Changes

- [#3](https://github.com/aurelienbobenrieth/harness/pull/3) [`29c77ff`](https://github.com/aurelienbobenrieth/harness/commit/29c77ff01858c38542be00cdfda0c9c4b96c5cbe) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 24 agentlint reviews for any TypeScript repo: a deterministic trigger finds the spot, an agent or a human settles it.
