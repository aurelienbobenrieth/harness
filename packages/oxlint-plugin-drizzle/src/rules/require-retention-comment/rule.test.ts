import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

it("reports a Postgres table without a retention decision", async () => {
  await assertRuleReports(
    "drizzle/require-retention-comment",
    "import { pgTable } from 'drizzle-orm/pg-core'; export const history = pgTable('history', {});",
  );
});

it("accepts adjacent retention JSDoc and ignores unrelated table helpers", async () => {
  await assertRuleDoesNotReport(
    "drizzle/require-retention-comment",
    "import { pgTable as table } from 'drizzle-orm/pg-core';\n/** @retention Delete after merchant recovery completes. */\nexport const history = table('history', {});",
  );
  await assertRuleDoesNotReport(
    "drizzle/require-retention-comment",
    "const pgTable = () => {}; pgTable('unrelated', {});",
  );
  await assertRuleReports(
    "drizzle/require-retention-comment",
    "import { pgTable } from 'drizzle-orm/pg-core';\n/** @retention */\nexport const history = pgTable('history', {});",
  );
});
