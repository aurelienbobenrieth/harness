import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "drizzle/fk-column-indexed";
const header =
  'import { foreignKey, index, integer, pgSchema, pgTable, primaryKey, text, unique, uniqueIndex } from "drizzle-orm/pg-core";\nconst users = pgTable("users", { id: integer().primaryKey() });\n';

it("reports a .references() column with no extra config", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export const posts = pgTable("posts", {\n  id: integer().primaryKey(),\n  authorId: integer("author_id").notNull().references(() => users.id),\n});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports when the only index covers the column in second position", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export const posts = pgTable(\n  "posts",\n  { id: integer().primaryKey(), slug: text(), authorId: integer().references(() => users.id) },\n  (t) => [index("posts_slug_author").on(t.slug, t.authorId)],\n);\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports a table-level foreignKey() and a pgSchema table", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export const posts = pgTable("posts", { id: integer(), authorId: integer() }, (t) => [\n  foreignKey({ columns: [t.authorId], foreignColumns: [users.id] }),\n]);\n`,
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      `${header}const app = pgSchema("app");\nexport const posts = app.table("posts", { authorId: integer().references(() => users.id) });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports the 0.x object-form extra config when it indexes another column", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export const posts = pgTable("posts", { slug: text(), authorId: integer().references(() => users.id) }, (t) => ({\n  slugIdx: uniqueIndex().on(t.slug),\n}));\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts a single-column index, a leading composite index, and ordering wrappers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export const posts = pgTable(\n  "posts",\n  (t) => ({ id: t.integer().primaryKey(), authorId: t.integer().references(() => users.id), editorId: t.integer().references(() => users.id), reviewerId: t.integer().references(() => users.id) }),\n  (t) => [\n    index().on(t.authorId),\n    index("by_editor").on(t.editorId.desc(), t.id),\n    index("by_reviewer").using("btree", t.reviewerId),\n  ],\n);\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts columns covered by primary keys and unique constraints", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export const memberships = pgTable(\n  "memberships",\n  { userId: integer().references(() => users.id), teamId: integer().references(() => users.id), profileId: integer().unique().references(() => users.id), ownerId: integer().references(() => users.id) },\n  (t) => [primaryKey({ columns: [t.userId, t.teamId] }), unique().on(t.ownerId), index().on(t.teamId)],\n);\nexport const settings = pgTable("settings", { userId: integer().primaryKey().references(() => users.id) });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("skips extra config that is not statically readable and non-Postgres tables", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}import { int, mysqlTable } from "drizzle-orm/mysql-core";\nconst shared = (t: { authorId: unknown }) => [index().on(t.authorId as never)];\nexport const posts = pgTable("posts", { authorId: integer().references(() => users.id) }, shared);\nexport const spread = pgTable("spread", { authorId: integer().references(() => users.id) }, (t) => [...[index().on(t.authorId)]]);\nexport const mysqlPosts = mysqlTable("posts", { authorId: int().references(() => users.id) });\n`,
    ),
  ).resolves.toBeUndefined();
});
