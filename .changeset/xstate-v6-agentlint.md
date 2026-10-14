---
"@aurelienbbn/agentlint-plugin-xstate": minor
---

Support XState v6 alpha and `@xstate/effect` alpha beside v5, and add the `spawn-id-collision` and `effect-actor-observed` reviews to `xstatePreset`.

All five existing rules raise their standard revision, so earlier acceptances need a fresh review. Their guidance now states per version what differs, and corrects claims that were false:

- an incompatible snapshot gives an actor in status `'error'`; it doesn't throw;
- in v6, `onError` recovers action and spawned-child errors.

Detection adds `enq.spawn`, context-factory `spawn`, `createInvoke`, the v6 logic creators, `fromEffect*`, `system.createActor`, `createEffectActor`, `createActorAtoms`, v6 context patches, and `schemas.context`.
