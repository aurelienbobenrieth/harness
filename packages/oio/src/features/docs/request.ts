import { Schema } from "effect";

export class DocsBuildCommand extends Schema.TaggedClass<DocsBuildCommand>()("DocsBuildCommand", {
  root: Schema.String,
  jsonPath: Schema.String,
  eventsPath: Schema.UndefinedOr(Schema.String),
  outputDir: Schema.String,
}) {}

export class DocsBuildResult extends Schema.TaggedClass<DocsBuildResult>()("DocsBuildResult", {
  lines: Schema.Array(Schema.String),
  exitCode: Schema.Number,
}) {}
