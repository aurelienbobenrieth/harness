import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "effect/no-tagged-error-name-field";
const imports = 'import { Data, Schema } from "effect";\n';
const message = (error: string) =>
  `Rename the field "name" of the tagged error "${error}": it shadows Error.name. Use a domain-specific field such as "queueName" or "domainName".`;

describe("reports", () => {
  it.each([
    [
      "Schema.TaggedError",
      'class QueueNotFoundError extends Schema.TaggedError<QueueNotFoundError>()("QueueNotFoundError", { name: Schema.String }) {}\n',
    ],
    [
      "Schema.TaggedErrorClass",
      'class QueueNotFoundError extends Schema.TaggedErrorClass<QueueNotFoundError>()("QueueNotFoundError", { name: Schema.String, id: Schema.String }) {}\n',
    ],
    [
      "a quoted key",
      'class QueueNotFoundError extends Schema.TaggedError<QueueNotFoundError>()("QueueNotFoundError", { "name": Schema.String }) {}\n',
    ],
    [
      "Data.TaggedError with an inline type",
      'class QueueNotFoundError extends Data.TaggedError("QueueNotFoundError")<{ readonly name: string }> {}\n',
    ],
    [
      "Data.TaggedError with a local interface",
      'interface Payload { readonly name: string }\nclass QueueNotFoundError extends Data.TaggedError("QueueNotFoundError")<Payload> {}\n',
    ],
    [
      "Data.TaggedError with a local type alias",
      'type Payload = { readonly name: string };\nclass QueueNotFoundError extends Data.TaggedError("QueueNotFoundError")<Payload> {}\n',
    ],
    [
      "an exported class",
      'export class QueueNotFoundError extends Schema.TaggedError<QueueNotFoundError>()("QueueNotFoundError", { name: Schema.String }) {}\n',
    ],
  ])("%s", async (_label, code) => {
    await expect(reportedMessages(ruleName, imports + code)).resolves.toEqual([message("QueueNotFoundError")]);
  });

  it("reports through a namespace-less named import", async () => {
    await assertRuleReports(
      ruleName,
      'import { TaggedError } from "effect/Data";\nclass FooError extends TaggedError("FooError")<{ name: string }> {}\n',
    );
  });
});

describe("stays silent", () => {
  it.each([
    [
      "a domain-specific field",
      'class QueueNotFoundError extends Schema.TaggedError<QueueNotFoundError>()("QueueNotFoundError", { queueName: Schema.String }) {}\n',
    ],
    ["an empty payload", 'class FooError extends Data.TaggedError("FooError") {}\n'],
    [
      "a type payload without name",
      'class FooError extends Data.TaggedError("FooError")<{ readonly id: string }> {}\n',
    ],
    [
      "a nested name",
      'class FooError extends Schema.TaggedError<FooError>()("FooError", { queue: Schema.Struct({ name: Schema.String }) }) {}\n',
    ],
    ["a class that is not a tagged error", "class Foo extends Base<{ name: string }> {}\n"],
    ["a plain schema class", 'class Foo extends Schema.Class<Foo>("Foo")({ name: Schema.String }) {}\n'],
    ["an unresolved payload reference", 'class FooError extends Data.TaggedError("FooError")<Imported> {}\n'],
  ])("%s", async (_label, code) => {
    await assertRuleDoesNotReport(ruleName, imports + code);
  });

  it("ignores a local Data that is not Effect's", async () => {
    await assertRuleDoesNotReport(
      ruleName,
      'const Data = { TaggedError: (tag: string) => class {} };\nclass FooError extends Data.TaggedError("FooError")<{ name: string }> {}\n',
    );
  });
});
