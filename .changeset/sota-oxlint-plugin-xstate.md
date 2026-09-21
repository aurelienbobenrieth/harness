---
"@aurelienbbn/oxlint-plugin-xstate": minor
---

Add eight XState v5 rules: no-imperative-action-creator (action creators called as discarded statements or returned from inline action arrows are silent no-ops), no-context-mutation (in-place mutation of machine context or `snapshot.context`; option `allowCollectionMethods`), no-machine-in-render (`createMachine`/`setup().createMachine`/`createActor`/`interpret` directly in a React component or hook body), named-actor-src (inline `invoke.src` / `spawnChild` logic instead of a `setup({ actors })` key; options `checkSpawn`, `guards`), stable-selector-result (inline `useSelector` selectors allocating an object or array without a comparator), and the lower-confidence no-unreachable-transition (unguarded branch before other branches, unguarded `always` loop), prefer-send-to (`sendParent`), promise-actor-abort-signal (`fromPromise` + `fetch` read ignoring `signal`).

require-setup-create-machine now also reports `setup()` called with no argument, `{}`, or an object literal lacking `types`. require-event-satisfies now also covers `sendParent`, `emit`, `enqueue.raise`/`sendTo`/`sendParent`/`emit`, and `.send` on actor refs from `useActorRef`, `<ActorContext>.useActorRef()`, and the `useMachine`/`useActor` tuple.
