import { expect, it } from "vitest";
import { fixCode } from "../sota-test-support.ts";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/matching-identifier";

it("reports a copied Context.Service key", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'class OrderRepo extends Context.Service<OrderRepo, { readonly find: () => void }>()("app/UserRepo") {}\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a copied Schema.TaggedError tag and Data.TaggedError tag", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("UserNotFound", { id: Schema.String }) {}\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'class OrderNotFound extends Data.TaggedError("UserNotFound")<{ readonly id: string }> {}\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a Self type argument naming another class", async () => {
  await expect(
    assertRuleReports(ruleName, 'class Order extends Schema.Class<User>("Order")({ id: Schema.String }) {}\n'),
  ).resolves.toBeUndefined();
});

it("allows path-prefixed keys and tags ending with the class name", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'class OrderRepo extends Context.Service<OrderRepo, { readonly find: () => void }>()("app/orders/OrderRepo") {}',
        'class Order extends Schema.Class<Order>("app/Order")({ id: Schema.String }) {}',
        'class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("orders/OrderNotFound", { id: Schema.String }) {}',
        'class Missing extends Data.TaggedError("orders/Missing")<{}> {}',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("skips non-literal keys and look-alike factories from other libraries", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import { Schema } from "other-schema";',
        "class OrderRepo extends Context.Service<OrderRepo, {}>()(orderRepoKey) {}",
        'class Order extends Schema.Class<Order>("User")({}) {}',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("honours stripSuffixes and ignore", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'class OrderNotFoundError extends Data.TaggedError("OrderNotFound")<{}> {}\n', {
      ruleConfig: ["error", { stripSuffixes: ["Error"] }],
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, 'class RenamedError extends Data.TaggedError("LegacyWireTag")<{}> {}\n', {
      ruleConfig: ["error", { ignore: ["RenamedError"] }],
    }),
  ).resolves.toBeUndefined();
});

it("suggests renaming only the last key segment", async () => {
  await expect(
    fixCode(ruleName, 'class OrderRepo extends Context.Service<OrderRepo, {}>()("app/UserRepo") {}\n', "suggestions"),
  ).resolves.toBe('class OrderRepo extends Context.Service<OrderRepo, {}>()("app/OrderRepo") {}\n');
  await expect(
    fixCode(
      ruleName,
      'class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("orders/UserNotFound", {}) {}\n',
      "suggestions",
    ),
  ).resolves.toBe('class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("orders/OrderNotFound", {}) {}\n');
});
