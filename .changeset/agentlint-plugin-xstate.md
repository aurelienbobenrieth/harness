---
"@aurelienbbn/agentlint-plugin-xstate": patch
---

`xstate/actor-cleanup` stays silent when the file already stops the stored actor (`actor.stop()`, `this.#actor?.stop()`, or a field copied from the creation binding). All 7 findings on one application were accepted with exactly that reason; the rule now reports only creations with no `stop()` on their binding.
