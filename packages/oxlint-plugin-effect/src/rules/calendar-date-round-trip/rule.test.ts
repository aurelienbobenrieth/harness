import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

it("reports date-shape validation that accepts impossible calendar days", async () => {
  await assertRuleReports(
    "effect/calendar-date-round-trip",
    "import { Schema } from 'effect'; const DateOnly = Schema.String.pipe(Schema.pattern(/^\\d{4}-\\d{2}-\\d{2}$/));",
  );
  await assertRuleReports(
    "effect/calendar-date-round-trip",
    "import { Schema } from 'effect'; const DateOnly = Schema.String.check(Schema.isPattern(/^\\d{4}-\\d{2}-\\d{2}$/));",
  );
});

it("accepts an explicit calendar predicate and ignores unrelated patterns", async () => {
  await assertRuleDoesNotReport(
    "effect/calendar-date-round-trip",
    "import { Schema } from 'effect'; const DateOnly = Schema.String.pipe(Schema.pattern(/^\\d{4}-\\d{2}-\\d{2}$/), Schema.filter(isCalendarDate));",
  );
  await assertRuleDoesNotReport(
    "effect/calendar-date-round-trip",
    "import { Schema } from 'effect'; const DateOnly = Schema.String.check(Schema.isPattern(/^\\d{4}-\\d{2}-\\d{2}$/), isCalendarDate);",
  );
  await assertRuleDoesNotReport(
    "effect/calendar-date-round-trip",
    "import { Schema } from 'effect'; const Code = Schema.String.pipe(Schema.pattern(/^[a-z]+$/));",
  );
  await assertRuleDoesNotReport(
    "effect/calendar-date-round-trip",
    "const Schema = { pattern: (x) => x }; Schema.pattern(/^\\d{4}-\\d{2}-\\d{2}$/);",
  );
});
