---
"@aurelienbbn/oxlint-plugin-effect": minor
---

`effect/telemetry-name-format` gains an opt-in `logMessages` option. With `logMessages: true`, the first argument of `Effect.log`, `logTrace`, `logDebug`, `logInfo`, `logWarning`, `logError` and `logFatal` is an event name: a literal in the span name format (`pattern`, `minSegments`), like `Effect.logInfo("webhook.rejected", { attempt })`. Variables, templates with values and concatenations are reported too. Without the option the rule behaves as before.
