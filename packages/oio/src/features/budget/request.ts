import { Schema } from "effect";

export const BudgetRule = Schema.Struct({
  pattern: Schema.String,
  maxBytes: Schema.Number,
});

export class BudgetCommand extends Schema.TaggedClass<BudgetCommand>()("BudgetCommand", {
  root: Schema.String,
  budgets: Schema.Array(BudgetRule),
}) {}

export class BudgetResult extends Schema.TaggedClass<BudgetResult>()("BudgetResult", {
  lines: Schema.Array(Schema.String),
  exitCode: Schema.Number,
}) {}
