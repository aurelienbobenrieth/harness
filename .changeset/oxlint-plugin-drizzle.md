---
"@aurelienbbn/oxlint-plugin-drizzle": minor
---

`fk-column-indexed` now also checks `sqliteTable` (D1 and SQLite do not index the referencing column either). `mysqlTable` stays out of scope because InnoDB creates that index itself.
