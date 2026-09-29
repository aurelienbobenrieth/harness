import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "effect/tagged-error-name";
const rootImport = 'import { Data, Schema } from "effect";\n';

const missingSuffix = (name: string, suffix = "Error") =>
  `Rename the tagged error class "${name}" to end with "${suffix}", and set its _tag to the new name.`;
const tagMismatch = (tag: string, name: string) =>
  `Change the _tag "${tag}" to "${name}": a tagged error's _tag equals its class name, so catchTag("${name}") leads back to the class.`;

describe("class name suffix", () => {
  it.each([
    ["Schema.TaggedError", 'class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {}) {}\n'],
    ["Schema.TaggedErrorClass", 'class NotFound extends Schema.TaggedErrorClass<NotFound>()("NotFound", {}) {}\n'],
    ["Data.TaggedError", 'class NotFound extends Data.TaggedError("NotFound")<{}> {}\n'],
    ["an exported declaration", 'export class NotFound extends Data.TaggedError("NotFound") {}\n'],
    ["a default-exported declaration", 'export default class NotFound extends Data.TaggedError("NotFound") {}\n'],
    ["a named class expression", 'const Missing = class NotFound extends Data.TaggedError("NotFound") {};\n'],
  ])("reports %s without the suffix", async (_label, code) => {
    await expect(reportedMessages(ruleName, rootImport + code)).resolves.toEqual([missingSuffix("NotFound")]);
  });

  it("honours a custom suffix", async () => {
    await expect(
      reportedMessages(ruleName, `${rootImport}class NotFoundError extends Data.TaggedError("NotFoundError") {}\n`, {
        ruleOptions: { suffix: "Failure" },
      }),
    ).resolves.toEqual([missingSuffix("NotFoundError", "Failure")]);
  });
});

describe("tag equals class name", () => {
  it.each([
    ["Schema.TaggedError", 'class NotFoundError extends Schema.TaggedError<NotFoundError>()("NotFound", {}) {}\n'],
    [
      "Schema.TaggedErrorClass with an identifier",
      'class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>("id")("NotFound", {}) {}\n',
    ],
    ["Data.TaggedError", 'class NotFoundError extends Data.TaggedError("NotFound")<{}> {}\n'],
    ["a no-substitution template tag", "class NotFoundError extends Data.TaggedError(`NotFound`) {}\n"],
  ])("reports %s whose tag differs", async (_label, code) => {
    await expect(reportedMessages(ruleName, rootImport + code)).resolves.toEqual([
      tagMismatch("NotFound", "NotFoundError"),
    ]);
  });

  it("reports both violations on one class", async () => {
    await expect(
      reportedMessages(ruleName, `${rootImport}class NotFound extends Data.TaggedError("Missing") {}\n`),
    ).resolves.toEqual([missingSuffix("NotFound"), tagMismatch("Missing", "NotFound")]);
  });
});

describe("Effect module resolution", () => {
  it.each([
    ["a Schema namespace import", 'import * as Schema from "effect/Schema";\n', "Schema.TaggedError<NotFound>()"],
    ["an aliased root Schema import", 'import { Schema as S } from "effect";\n', "S.TaggedError<NotFound>()"],
    ["a named Schema import", 'import { TaggedError } from "effect/Schema";\n', "TaggedError<NotFound>()"],
  ])("reports through %s", async (_label, header, constructor) => {
    await expect(
      assertRuleReports(ruleName, `${header}class NotFound extends ${constructor}("NotFound", {}) {}\n`),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["a Data namespace import", 'import * as Data from "effect/Data";\n', "Data.TaggedError"],
    ["an aliased root Data import", 'import { Data as D } from "effect";\n', "D.TaggedError"],
    ["a named Data import", 'import { TaggedError as Tagged } from "effect/Data";\n', "Tagged"],
  ])("reports through %s", async (_label, header, constructor) => {
    await expect(
      assertRuleReports(ruleName, `${header}class NotFound extends ${constructor}("NotFound") {}\n`),
    ).resolves.toBeUndefined();
  });
});

describe("stays silent", () => {
  it("on conforming tagged errors", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        [
          rootImport,
          'class NotFoundError extends Schema.TaggedError<NotFoundError>()("NotFoundError", {}) {}',
          'class GoneError extends Schema.TaggedErrorClass<GoneError>()("GoneError", {}) {}',
          'class MissingError extends Data.TaggedError("MissingError")<{ readonly id: string }> {}',
          "",
        ].join("\n"),
      ),
    ).resolves.toBeUndefined();
  });

  it("on the tag check when the tag is not a string literal", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        `${rootImport}const tag = "Missing";\nclass NotFoundError extends Schema.TaggedError<NotFoundError>()(tag, {}) {}\nclass GoneError extends Data.TaggedError(\`\${tag}Gone\`) {}\n`,
      ),
    ).resolves.toBeUndefined();
  });

  it("on anonymous classes", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        `${rootImport}export default class extends Data.TaggedError("Missing") {}\nconst NotFound = class extends Schema.TaggedError<unknown>()("Gone", {}) {};\n`,
      ),
    ).resolves.toBeUndefined();
  });

  it("on tagged classes that are not errors", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        `${rootImport}class User extends Schema.TaggedClass<User>()("Person", {}) {}\nclass Point extends Data.TaggedClass("Coordinate") {}\nclass Plain extends Data.Error {}\n`,
      ),
    ).resolves.toBeUndefined();
  });

  it("on look-alikes that are not Effect modules", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        [
          'import { Schema } from "other-schema";',
          'import { TaggedError } from "effect/Data";',
          'class NotFound extends Schema.TaggedError<NotFound>()("Missing", {}) {}',
          "function local(Data: { TaggedError: (tag: string) => new () => object }) {",
          '  return class Gone extends Data.TaggedError("Missing") {};',
          "}",
          'class Wrong extends TaggedError<Wrong>()("Missing", {}) {}',
          "",
        ].join("\n"),
      ),
    ).resolves.toBeUndefined();
  });

  it("on a name carrying the custom suffix", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        `${rootImport}class NotFoundFailure extends Data.TaggedError("NotFoundFailure") {}\n`,
        { ruleOptions: { suffix: "Failure" } },
      ),
    ).resolves.toBeUndefined();
  });
});
