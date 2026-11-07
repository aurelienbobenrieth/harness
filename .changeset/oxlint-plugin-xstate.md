---
"@aurelienbbn/oxlint-plugin-xstate": minor
---

`xstate/machine-naming` has no default naming convention: it requires an explicitly configured `pattern`, and without one reports once per file that defines a machine. `xstate/require-event-satisfies` no longer lists bare `send` in the default `sendCalleeNames` (still opt-in); binding-proven senders such as `actorRef.send` are unchanged without options. `xstate/valid-duration` rejects every duration string (`"PT5S"`, `"5s"`) in XState v5 files, where delays are numbers or declared names. `xstate/no-persist-live-snapshot` skips test files.
