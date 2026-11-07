---
"@aurelienbbn/conformance-cloudflare": patch
---

`compatibility-date-current` reports a date older than `compatibilityDateMaxAgeDays` (default 180 days) as a warning instead of a failure: an old date is a maintenance nudge, not a broken config. It also reports a missing `nodejs_compat` on a pre-2026-08-04 date as a warning: 18 of 18 Cloudflare templates in that state import no `node:` module, and whether the flag is needed depends on the Worker's dependencies. The README states that the package reads wrangler configs and does not apply to Alchemy-declared Workers.
