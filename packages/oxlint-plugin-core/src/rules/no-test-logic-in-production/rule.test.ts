import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-test-logic-in-production";
const sourceFile = { filename: "src/domain/mailer.ts" };

it.each([
  'export const send = (mail) => (process.env.NODE_ENV === "test" ? undefined : deliver(mail));',
  'if ("test" !== import.meta.env.MODE) start();',
  'if (process.env["NODE_ENV"] == "test") skip();',
  "export const retries = process.env.VITEST ? 0 : 3;",
  "const worker = process.env.VITEST_WORKER_ID ?? process.env.JEST_WORKER_ID;",
  'if (import.meta.vitest) { const { it } = import.meta.vitest; it("adds", () => {}); }',
])("reports production code that detects the test run: %s", async (source) => {
  await assertRuleReports(ruleName, source, sourceFile);
});

it.each([
  'if (process.env.NODE_ENV === "production") harden();',
  'if (config.NODE_ENV === "test") skip();',
  'if (import.meta.env.MODE === "development") debug();',
  "const verbose = process.env.VITE_VERBOSE === undefined;",
  'const mode = process.env.NODE_ENV; log("test", mode);',
  "if (import.meta.hot) import.meta.hot.accept();",
])("stays silent on other environment reads: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, sourceFile);
});

it.each([
  "export const __testing__ = { parse };",
  "export const _internal = { parse };",
  "function resetCacheForTests() {} export { resetCacheForTests };",
  "function reset() {} export { reset as testOnlyReset };",
  "export function parseForTesting(input) { return input; }",
  "// exported for testing\nexport function parse(input) { return input; }",
  "/** Visible only for unit tests. */\nexport const parse = (input) => input;",
])("reports exports that exist for tests only: %s", async (source) => {
  await assertRuleReports(ruleName, source, sourceFile);
});

it.each([
  "export const internalsReport = { parse };",
  "export function runForTestimonials() {}",
  "const __testing__ = 2; export const value = __testing__;",
  "// Exported for the router\nexport function parse(input) { return input; }",
  "// exported for testing\nconst helper = 1;\nexport function parse(input) { return input + helper; }",
  "export type ParseForTests = string;",
])("stays silent on near-miss export names and comments: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, sourceFile);
});

it.each(["src/domain/mailer.test.ts", "vitest.setup.ts", "src/test-utils/env.ts", "src/testing/env.ts"])(
  "ignores files that may hold test-only code: %s",
  async (filename) => {
    await assertRuleDoesNotReport(ruleName, "export const __testing__ = process.env.VITEST;", { filename });
  },
);
