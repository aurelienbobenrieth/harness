---
"@aurelienbbn/oxlint-plugin-xstate": minor
"@aurelienbbn/agentlint-plugin-xstate": minor
---

Add three XState steering rules. oxlint: require-setup-create-machine (bare `createMachine(...)` imported from xstate must become `setup({...}).createMachine(...)` so actions, guards, actors, and types are declared) and require-event-satisfies (object-literal events with a `type` property passed to `send`/`raise`/`sendTo` must be checked with `satisfies` against the machine's event type; callee names configurable via `sendCalleeNames`). agentlint: derived-boolean-context (assign() calls in machine files caching availability flags like `canSubmit`/`isReady` in context — model the predicate as a guard and read `snapshot.can(event)` from the UI; configurable via `contextFlagPattern` and `machineFilePattern`).
