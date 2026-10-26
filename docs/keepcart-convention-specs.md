# KeepCart convention candidates

These need KeepCart semantics and belong in its own `tools/conventions`.

- **4, independent grants:** each grant in the entitlement registry must have a landing page authorized by that grant alone; fixture: `billing_read` resolves to `/billing/pricing-lab` without requiring other grants. Unknown grants fail closed.
- **6, suffix registry:** every suffix read by a convention tool, including `.scenario`, must occur in `tools/conventions/names.ts` and the NAME check; fixture: a tool reading `*.scenario.ts` while the registry omits `.scenario` fails. A registered suffix without a reader needs an explicit reserved-purpose entry.
- **10, cut-switch warnings:** shared-shell warnings derive from current switch state and survive client navigation; fixture: cut `messaging.merchant_email`, navigate Flags to Jobs, and assert the same accessible warning remains visible until restored.

## Replay boundary contracts

- PauseProtection and PublishStagedRevision require a current installation before platform writes. WriteRevision can supersede an obsolete install without a platform write; preserve its existing integration suite when moving authority decisions.
- ValidationReads configuration failure is a normal refusal at the public edge, not an outage fail-open or an uncaught defect. Forwarded legacy results retain their discriminant; check every touched producer and consumer with scoped type-aware lint.
- Shell nav-counts, nav, navigation-commands and preferences import errors/jobs through api.ts. Keep KeepCart's scoped lint and dependency rules authoritative.
- Archive codec: generated JSON pages preserve records, order, Unicode, byte views and exactly one zstd frame, checked with an independent decoder. Keep seed/shrink evidence.
- Bulk UI: retain 25/26 threshold examples; a real-browser flow enters a reason, rejects the wrong count, accepts the exact count and cancels without writing. Store browser profiles outside source.
