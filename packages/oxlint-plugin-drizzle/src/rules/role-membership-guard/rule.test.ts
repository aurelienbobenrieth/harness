import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

it("reports role-name equality as a sole SQL authorization guard", async () => {
  await assertRuleReports(
    "drizzle/role-membership-guard",
    "import { sql } from 'drizzle-orm'; sql`CREATE POLICY jobs ON tasks USING (current_user = 'jobs');`;",
  );
});

it("allows membership guards and ordinary identity projection", async () => {
  await assertRuleDoesNotReport(
    "drizzle/role-membership-guard",
    "import { sql } from 'drizzle-orm'; sql`CREATE POLICY jobs ON tasks USING (pg_has_role(current_user, 'jobs', 'MEMBER'));`;",
  );
  await assertRuleDoesNotReport(
    "drizzle/role-membership-guard",
    "import { sql } from 'drizzle-orm'; sql`SELECT current_user = 'jobs' AS is_jobs;`;",
  );
});
