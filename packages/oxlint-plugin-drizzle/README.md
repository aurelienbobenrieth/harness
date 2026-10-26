# @aurelienbbn/oxlint-plugin-drizzle

[![npm](https://img.shields.io/npm/v/@aurelienbbn/oxlint-plugin-drizzle)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-drizzle) [![downloads](https://img.shields.io/npm/dm/@aurelienbbn/oxlint-plugin-drizzle)](https://www.npmjs.com/package/@aurelienbbn/oxlint-plugin-drizzle) [![CI](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aurelienbobenrieth/harness/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@aurelienbbn/oxlint-plugin-drizzle)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-drizzle/LICENSE) [![node](https://img.shields.io/node/v/@aurelienbbn/oxlint-plugin-drizzle)](https://github.com/aurelienbobenrieth/harness/blob/main/packages/oxlint-plugin-drizzle/package.json)

**4 oxlint rules for Drizzle Postgres schemas: every foreign-key column leads an index, before production traffic finds the sequential scan.**

> [!NOTE]
> **Release candidate.** No consumer has calibrated it yet.

```sh
pnpm add -D @aurelienbbn/oxlint-plugin-drizzle oxlint   # oxlint >=1.82.0 <2.0.0
```

```json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-drizzle"],
  "rules": {
    "drizzle/fk-column-indexed": "error"
  }
}
```

No preset, no autofix: index shape (single, composite, partial) is a design choice.

## What fires

```ts
export const posts = pgTable("posts", {
  authorId: integer().references(() => users.id), // ❌ fk-column-indexed
});

export const indexedPosts = pgTable(
  "indexed_posts",
  { authorId: integer().references(() => users.id) },
  (t) => [index().on(t.authorId)], // ✅
);
```

**Postgres only.** MySQL InnoDB creates an index for each foreign key when none exists, so `mysqlTable` is out of scope. Neither `drizzle-kit` (0.31.11, 1.0.0-rc.4) nor `eslint-plugin-drizzle` (0.2.3) checks this.

<details>
<summary>Exact trigger and scope</summary>

| ❌ Fires on                                                                                                         | Covered by / ⏭️ skipped                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a `.references(...)` column, or the first column of `foreignKey({ columns })`, that no covering builder starts with | `index` / `uniqueIndex` / `unique` `.on(t.col, ...)` or `.using(method, t.col, ...)`, `primaryKey({ columns: [t.col, ...] })`, column-level `.primaryKey()` / `.unique()`. Tables from `pgTable` or `pgSchema(...).table` imported from `drizzle-orm/pg-core`; object or callback columns; array or 0.x object extra config. ⏭️ extra config that isn't an inline arrow returning a literal, or that contains spreads |

</details>

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                  | Trigger or review scope                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constraint-not-valid`      | Add PostgreSQL foreign-key and CHECK constraints as NOT VALID before validating existing rows separately.                                                   |
| `fk-column-indexed`         | Require each foreign-key column of a Drizzle pgTable (.references() or foreignKey()) to be the first column of an index, unique constraint, or primary key. |
| `require-retention-comment` | Document each pgTable retention policy in adjacent @retention JSDoc.                                                                                        |
| `role-membership-guard`     | Use PostgreSQL role membership rather than current_user equality in SQL policy guards.                                                                      |

### Credited concepts

- https://www.postgresql.org/docs/current/ddl-constraints.html (inspiration; independently implemented)
- planetscale/database-skills skills/postgres/references/schema-design.md by PlanetScale (MIT, concept)

<!-- harness-catalog:end -->

## Advisory rules

Merge the exported `advisoryRules` into your oxlint rules (or enable these names as `warn`): `drizzle/constraint-not-valid`, `drizzle/require-retention-comment`, `drizzle/role-membership-guard`. No autofix: each needs a domain decision.

| New rule (`warn`)           | Trigger and limits                                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constraint-not-valid`      | Complete static Drizzle `sql` templates adding a foreign-key or CHECK constraint without NOT VALID; no UNIQUE/PK rewrite, interpolated SQL and standalone .sql files require migration review. |
| `require-retention-comment` | Imported `pgTable` declarations without adjacent JSDoc `@retention` text; records the decision, does not enforce deletion jobs.                                                                |
| `role-membership-guard`     | A policy USING/WITH CHECK clause consisting solely of current_user equality; asks for inherited-role membership. Identity-specific policies may intentionally keep equality.                   |
