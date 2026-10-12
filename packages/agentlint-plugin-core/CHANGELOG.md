# @aurelienbbn/agentlint-plugin-core

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
