import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

it("reports optional or unvalidated reasons in destructive command schemas", async () => {
  await assertRuleReports(
    "effect/destructive-reason-required",
    "import { Schema } from 'effect'; const DeleteRecord = Schema.Struct({ id: Schema.String, reason: Schema.optional(StaffReasonSchema) });",
  );
  await assertRuleReports(
    "effect/destructive-reason-required",
    "import { Schema } from 'effect'; const PurgeRecords = Schema.Struct({ reason: Schema.String });",
  );
  await assertRuleReports(
    "effect/destructive-reason-required",
    "import { Schema } from 'effect'; const DeleteRecord = Schema.Struct({ id: Schema.String });",
  );
  await assertRuleReports(
    "effect/destructive-reason-required",
    "import { Schema } from 'effect'; const DeleteRecord = Schema.Struct({ reason: Schema.String.pipe(Schema.filter(reason => reason.trim().length >= 1)) });",
  );
});

it("accepts a required refined reason and ignores unrelated schemas", async () => {
  await assertRuleDoesNotReport(
    "effect/destructive-reason-required",
    "import { Schema } from 'effect'; const DeleteRecord = Schema.Struct({ reason: StaffReasonSchema });",
  );
  await assertRuleDoesNotReport(
    "effect/destructive-reason-required",
    "import { Schema } from 'effect'; const DeleteRecord = Schema.Struct({ reason: Schema.String.pipe(Schema.filter(reason => reason.trim().length >= 10)) });",
  );
  await assertRuleDoesNotReport(
    "effect/destructive-reason-required",
    "import { Schema } from 'effect'; const SearchRecords = Schema.Struct({ reason: Schema.optional(Schema.String) });",
  );
});
