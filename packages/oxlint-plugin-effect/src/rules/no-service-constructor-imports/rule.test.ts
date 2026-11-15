import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-service-constructor-imports";
const effectImport = 'import { Layer } from "effect";\n';

it("reports make-prefixed named imports from relative sources", async () => {
  await expect(
    assertRuleReports(ruleName, `${effectImport}import { makeUserRepo } from "./services/user-repo.js";\n`),
  ).resolves.toBeUndefined();
});

it("reports aliased constructor imports by their imported name", async () => {
  await expect(
    assertRuleReports(ruleName, `${effectImport}import { makeMailer as buildMailer } from "../services/mailer.js";\n`),
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
    assertRuleDoesNotReport(ruleName, `${effectImport}import { makeUserRepo } from "./services/user-repo.js";\n`, {
      filename: "user-repo.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it('accepts regression: import { makeUrl } from "./url.js";', async () => {
  await assertRuleDoesNotReport(ruleName, 'import { makeUrl } from "./url.js";');
});

it("allows a make-prefixed import from a services folder in a file that does not import Effect", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { makeStore } from "./services/store.js";\n'),
  ).resolves.toBeUndefined();
});
