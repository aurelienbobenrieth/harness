# @aurelienbbn/agentlint-plugin-alchemy

## 0.1.1

### Patch Changes

- [#41](https://github.com/aurelienbobenrieth/harness/pull/41) [`d073fdc`](https://github.com/aurelienbobenrieth/harness/commit/d073fdc61bc9cfc9d0cbded23286fa82af00f685) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - The agentlint plugins accept `@aurelienbbn/agentlint` 0.4 as a peer (`>=0.3.0 <0.5.0`), whose TSX grammar parses a `&` inside a JSX string attribute such as Tailwind's `className="[&_svg]:size-4"`. The compatibility `current` profile now tests agentlint 0.4.0.

## 0.1.0

### Minor Changes

- [#26](https://github.com/aurelienbobenrieth/harness/pull/26) [`db5fab9`](https://github.com/aurelienbobenrieth/harness/commit/db5fab945668b30d43d420ff14773fc884c1c448) Thanks [@aurelienbobenrieth](https://github.com/aurelienbobenrieth)! - Initial release. 6 agentlint reviews for Alchemy v2 stacks: resource replacement, removal policy, state store changes, adoption, and opt-in init Config exposure.
