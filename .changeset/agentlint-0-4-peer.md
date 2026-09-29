---
"@aurelienbbn/agentlint-plugin-alchemy": patch
"@aurelienbbn/agentlint-plugin-core": patch
"@aurelienbbn/agentlint-plugin-effect": patch
"@aurelienbbn/agentlint-plugin-shopify-app": patch
"@aurelienbbn/agentlint-plugin-tanstack-query": patch
"@aurelienbbn/agentlint-plugin-xstate": patch
---

The agentlint plugins accept `@aurelienbbn/agentlint` 0.4 as a peer (`>=0.3.0 <0.5.0`), whose TSX grammar parses a `&` inside a JSX string attribute such as Tailwind's `className="[&_svg]:size-4"`. The compatibility `current` profile now tests agentlint 0.4.0.
