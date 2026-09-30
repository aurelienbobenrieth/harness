import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "effect/schema-literal-case";

it("reports every non-snake_case value, naming the value and the expected case", async () => {
  await expect(
    reportedMessages(
      ruleName,
      'import { Schema } from "effect";\nexport const Action = Schema.Literals(["Replay", "run now", "cancel", "RunNow"]);\n',
    ),
  ).resolves.toEqual([
    'Rename the literal "Replay" to snake case (like "partially_refunded"): Schema.Literals values travel as data in URLs, SQL, logs, and wire contracts, so they share one case.',
    'Rename the literal "run now" to snake case (like "partially_refunded"): Schema.Literals values travel as data in URLs, SQL, logs, and wire contracts, so they share one case.',
    'Rename the literal "RunNow" to snake case (like "partially_refunded"): Schema.Literals values travel as data in URLs, SQL, logs, and wire contracts, so they share one case.',
  ]);
});

it("reports kebab, trailing-underscore and digit-first values under the default snake case", async () => {
  await expect(
    reportedMessages(
      ruleName,
      'const Status = Schema.Literals(["pending", "partially-refunded", "refunded_", "2fa", "double__underscore", ""]);\n',
    ),
  ).resolves.toHaveLength(5);
});

it("reports through a namespace alias and a named Literals import", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import * as S from "effect/Schema";\nconst Status = S.Literals(["Pending"] as const);\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, 'import { Literals } from "effect/Schema";\nconst Status = Literals(["Pending"]);\n'),
  ).resolves.toBeUndefined();
});

it("checks only the string literals next to a spread", async () => {
  await expect(
    reportedMessages(ruleName, 'const Tab = Schema.Literals([...Phase.literals, "archived", "Archived"]);\n'),
  ).resolves.toHaveLength(1);
  await expect(
    assertRuleDoesNotReport(ruleName, 'const Tab = Schema.Literals([...Phase.literals, "archived"]);\n'),
  ).resolves.toBeUndefined();
});

it("allows snake_case values, non-string literals and out-of-scope schemas", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import { Schema } from "effect";',
        'const Status = Schema.Literals(["pending", "partially_refunded", "requires_payment_method", "v2"]);',
        "const Code = Schema.Literals([200, 404, true, null]);",
        'const Message = Schema.Literal("Order not found.");',
        'class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}',
        'const Created = Schema.TaggedStruct("OrderCreated", {});',
        'const Other = Local.Literals(["Pending"]);',
        "const Dynamic = Schema.Literals(values);",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("ignores a local Schema that shadows the Effect import", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'const Schema = { Literals: (values: string[]) => values };\nconst Status = Schema.Literals(["Pending"]);\n',
    ),
  ).resolves.toBeUndefined();
});

it("honours the case option", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const Status = Schema.Literals(["partially-refunded", "open"]);\n', {
      ruleOptions: { case: "kebab" },
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, 'const Action = Schema.Literals(["runNow", "cancel"]);\n', {
      ruleOptions: { case: "camel" },
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, 'const Action = Schema.Literals(["RunNow", "Cancel"]);\n', {
      ruleOptions: { case: "pascal" },
    }),
  ).resolves.toBeUndefined();
  await expect(
    reportedMessages(ruleName, 'const Action = Schema.Literals(["run_now", "cancel"]);\n', {
      ruleOptions: { case: "pascal" },
    }),
  ).resolves.toEqual([
    'Rename the literal "run_now" to pascal case (like "PartiallyRefunded"): Schema.Literals values travel as data in URLs, SQL, logs, and wire contracts, so they share one case.',
    'Rename the literal "cancel" to pascal case (like "PartiallyRefunded"): Schema.Literals values travel as data in URLs, SQL, logs, and wire contracts, so they share one case.',
  ]);
});
