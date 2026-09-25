import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-service-constructor-imports";

it("reports make-prefixed named imports from relative sources", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { makeUserRepo } from "./services/user-repo.js";\n'),
  ).resolves.toBeUndefined();
});

it("reports aliased constructor imports by their imported name", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { makeMailer as buildMailer } from "../services/mailer.js";\n'),
  ).resolves.toBeUndefined();
});

it("allows make-prefixed imports from package specifiers", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { makeClient } from "@acme/client";\n'),
  ).resolves.toBeUndefined();
});

it("allows non-constructor named imports from relative sources", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { UserRepo, makeshift } from "./services/user-repo.js";\n'),
  ).resolves.toBeUndefined();
});

it("allows constructor imports in test files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { makeUserRepo } from "./services/user-repo.js";\n', {
      filename: "user-repo.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it('accepts regression: import { makeUrl } from "./url.js";', async () => {
  await assertRuleDoesNotReport(ruleName, 'import { makeUrl } from "./url.js";');
});
