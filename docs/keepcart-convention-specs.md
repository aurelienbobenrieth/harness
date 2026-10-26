# KeepCart convention candidates

These need KeepCart semantics and belong in its own `tools/conventions`.

- **4, independent grants:** each grant in the entitlement registry must have a landing page authorized by that grant alone; fixture: `billing_read` resolves to `/billing/pricing-lab` without requiring other grants. Unknown grants fail closed.
- **6, suffix registry:** every suffix read by a convention tool, including `.scenario`, must occur in `tools/conventions/names.ts` and the NAME check; fixture: a tool reading `*.scenario.ts` while the registry omits `.scenario` fails. A registered suffix without a reader needs an explicit reserved-purpose entry.
- **10, cut-switch warnings:** shared-shell warnings derive from current switch state and survive client navigation; fixture: cut `messaging.merchant_email`, navigate Flags to Jobs, and assert the same accessible warning remains visible until restored.
