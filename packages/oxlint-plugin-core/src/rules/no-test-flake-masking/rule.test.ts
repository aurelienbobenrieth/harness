import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "core/no-test-flake-masking";
const testFile = { filename: "cart.test.ts" };
const retry = expect.stringMatching(/^A retry makes a flaky test pass on rerun/u);
const timeout = expect.stringMatching(/^A timeout on one test, suite or hook hides/u);

it("reports a retry in a test's options", async () => {
  const code = 'import { it } from "vitest"; it("checks out", { retry: 2 }, async () => {});';

  await expect(reportedMessages(ruleName, code, testFile)).resolves.toEqual([retry]);
});

it("reports retry and timeout options passed after the test body", async () => {
  const code = 'it("checks out", async () => {}, { retry: 3, timeout: 60_000 });';

  await expect(reportedMessages(ruleName, code, testFile)).resolves.toEqual([retry, timeout]);
});

it("reports a positional timeout on a parameterized test", async () => {
  const code = 'test.each([1, 2])("adds %i", async () => {}, 20_000);';

  await expect(reportedMessages(ruleName, code, testFile)).resolves.toEqual([timeout]);
});

it("reports a timeout passed to an extended test API such as it.effect", async () => {
  const code = 'import { it } from "vitest"; it.effect("syncs", () => run(), { timeout: 30_000 });';

  await expect(reportedMessages(ruleName, code, testFile)).resolves.toEqual([timeout]);
});

it("reports a raised hook timeout", async () => {
  await assertRuleReports(ruleName, "beforeAll(async () => { await seed(); }, 120_000);", testFile);
});

it("reports retries and timeouts set at runtime with vi.setConfig", async () => {
  const code = "vi.setConfig({ retry: 1, testTimeout: 45_000 });";

  await expect(reportedMessages(ruleName, code, { filename: "vitest.setup.ts" })).resolves.toEqual([retry, timeout]);
});

it("reports a CI-only retry in the Vitest config", async () => {
  const code = "export default defineConfig({ test: { retry: process.env.CI ? 3 : 0 } });";

  await expect(reportedMessages(ruleName, code, { filename: "vitest.config.ts" })).resolves.toEqual([retry]);
});

it("allows switching retries off and repeating a test to surface its flake", async () => {
  await assertRuleDoesNotReport(ruleName, 'it("checks out", { retry: 0, repeats: 20 }, async () => {});', testFile);
});

it("allows a suite-wide timeout budget in the Vitest config", async () => {
  const code = "export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 60_000 } });";

  await assertRuleDoesNotReport(ruleName, code, { filename: "vite.config.ts" });
});

it("ignores a test-shaped settings object outside a Vitest config", async () => {
  await assertRuleDoesNotReport(ruleName, "export const settings = { test: { retry: 2 } };", {
    filename: "settings.ts",
  });
});

it("ignores a test registration outside test files", async () => {
  await assertRuleDoesNotReport(ruleName, 'test("checks out", async () => {}, 20_000);', { filename: "cart.ts" });
});
