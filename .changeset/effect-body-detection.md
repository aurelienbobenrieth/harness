---
"@aurelienbbn/oxlint-plugin-effect": patch
---

Effect body rules now also recognize generators passed to named `effect/Effect` imports (`gen`, `fn`, `fnUntraced`, `fnUntracedEager`, aliased or not) and named generators passed by reference (`function* program() {}; Effect.gen(program)`).
