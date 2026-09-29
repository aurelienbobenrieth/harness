---
"@aurelienbbn/oxlint-config": minor
---

`eslint/sort-keys` is off in the strict preset. Declaration order carries meaning that alphabetical order erases: an Effect Schema or Drizzle table lists `id` first and timestamps last, and Drizzle keeps that order as the physical column order. Code that is already sorted stays valid.
