import { Schema } from "effect";

export const ScaffoldKind = Schema.Literals(["block", "snippet", "section", "enhancer", "machine"]);
export type ScaffoldKind = Schema.Schema.Type<typeof ScaffoldKind>;

export class ScaffoldCommand extends Schema.TaggedClass<ScaffoldCommand>()("ScaffoldCommand", {
  root: Schema.String,
  kind: ScaffoldKind,
  id: Schema.String,
  namespace: Schema.String,
  jsonPath: Schema.String,
}) {}

export class ScaffoldResult extends Schema.TaggedClass<ScaffoldResult>()("ScaffoldResult", {
  lines: Schema.Array(Schema.String),
  exitCode: Schema.Number,
}) {}
