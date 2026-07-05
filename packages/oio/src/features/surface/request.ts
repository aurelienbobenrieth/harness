import { Schema } from "effect";

export class SurfaceAuditCommand extends Schema.TaggedClass<SurfaceAuditCommand>()("SurfaceAuditCommand", {
  root: Schema.String,
  jsonPath: Schema.String,
}) {}

export class SurfaceAuditResult extends Schema.TaggedClass<SurfaceAuditResult>()("SurfaceAuditResult", {
  lines: Schema.Array(Schema.String),
  exitCode: Schema.Number,
}) {}
