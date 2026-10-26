---
"@aurelienbbn/oxlint-plugin-shopify-app": patch
"@aurelienbbn/oxlint-plugin-core": minor
---

Scope Function runtime restrictions to source beneath a shopify.extension.toml declaring type = "function" (modern extensions array or legacy top-level declaration). App server and UI extension APIs stay available.

Add harness-format-padding: run only the statement-spacing autofix as part of formatting. Remove both padding rules from reported steering findings; consumers should disable them in lint and run harness-format-padding after oxfmt.
