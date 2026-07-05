import { Schema } from "effect";

export class RegistryCheckCommand extends Schema.TaggedClass<RegistryCheckCommand>()("RegistryCheckCommand", {
  root: Schema.String,
  markdownPath: Schema.String,
  jsonPath: Schema.String,
  statuses: Schema.Array(Schema.String),
  minCount: Schema.Number,
}) {}

export class RegistrySyncCommand extends Schema.TaggedClass<RegistrySyncCommand>()("RegistrySyncCommand", {
  root: Schema.String,
  markdownPath: Schema.String,
  jsonPath: Schema.String,
  statuses: Schema.Array(Schema.String),
}) {}

export class RegistryResult extends Schema.TaggedClass<RegistryResult>()("RegistryResult", {
  lines: Schema.Array(Schema.String),
  exitCode: Schema.Number,
}) {}
