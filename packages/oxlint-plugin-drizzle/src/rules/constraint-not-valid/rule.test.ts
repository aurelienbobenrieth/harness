import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

it("reports validating existing rows while adding a foreign key or check", async () => {
  await assertRuleReports(
    "drizzle/constraint-not-valid",
    "import { sql } from 'drizzle-orm'; sql`ALTER TABLE items ADD CONSTRAINT owner_fk FOREIGN KEY (owner_id) REFERENCES owners(id);`;",
  );
  await assertRuleReports(
    "drizzle/constraint-not-valid",
    "import { sql as query } from 'drizzle-orm'; query`ALTER TABLE items ADD CONSTRAINT positive CHECK (amount > 0);`;",
  );
});

it("allows deferred validation, unique constraints, unrelated strings and interpolated SQL", async () => {
  await Promise.all(
    [
      "ALTER TABLE items ADD CONSTRAINT fk FOREIGN KEY (id) REFERENCES owners(id) NOT VALID;",
      "ALTER TABLE items ADD CONSTRAINT uq UNIQUE (id);",
      "ALTER TABLE items VALIDATE CONSTRAINT fk;",
    ].map((sql) =>
      assertRuleDoesNotReport("drizzle/constraint-not-valid", `import { sql } from 'drizzle-orm'; sql\`${sql}\`;`),
    ),
  );
  await assertRuleDoesNotReport(
    "drizzle/constraint-not-valid",
    "const sql = (v) => v; sql`ALTER TABLE items ADD CONSTRAINT fk CHECK (id > 0);`;",
  );
  await assertRuleDoesNotReport(
    "drizzle/constraint-not-valid",
    "import { sql } from 'drizzle-orm'; sql`ALTER TABLE ${table} ADD CONSTRAINT fk CHECK (id > 0);`;",
  );
});
