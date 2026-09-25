import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-error-message-matching";

it.each([
  'export function classify(error: unknown) { if ((error as Error).message.includes("timeout")) return "retry"; return "fail"; }',
  'export function classify(err: Error) { return err.message === "Not found"; }',
  'export function classify(err: Error) { return "Not found" != err.message; }',
  'export function classify(e: Error) { switch (e.message) { case "a": return 1; default: return 0; } }',
  'export function classify(error: Error) { return error.message.toLowerCase().trim().startsWith("econn"); }',
  "export function classify(error: Error) { return /timed? ?out/i.test(error.message); }",
  "export function classify(error: Error) { return error.message.match(/timeout/) !== null; }",
  'export function classify(loadError: Error) { return loadError.message.indexOf("quota") >= 0; }',
  'export function classify(result: Failure) { return (result.cause as Error).message.endsWith("denied"); }',
  'export function run() { try { sync(); } catch (failure) { if (failure.message.includes("busy")) retry(); else throw failure; } }',
  'export function run() { try { sync(); } catch (failure) { if (String(failure).includes("busy")) retry(); else throw failure; } }',
  'export function run() { try { sync(); } catch (failure) { if (`${failure}`.includes("busy")) retry(); else throw failure; } }',
  'export const result = promise.catch((problem) => (problem.message === "gone" ? undefined : Promise.reject(problem)));',
])("reports control flow keyed on error text: %s", async (source) => {
  await assertRuleReports(ruleName, source);
});

it.each([
  "export function classify(error: unknown) { return error instanceof TimeoutError; }",
  'export function classify(error: NodeError) { return error.code === "ETIMEDOUT"; }',
  "export function describe(error: Error) { return `Sync failed: ${error.message}`; }",
  "export function log(error: Error) { logger.error(error.message); }",
  'export function isGreeting(chat: Chat) { return chat.message.includes("hello"); }',
  'export function isGreeting(event: ChatEvent) { return event.message === "hello"; }',
  "export function same(error: Error, other: Error) { return error.message === other.message; }",
  "export function size(error: Error) { return error.message.length > 0; }",
  'export function field(error: Record<string, string>) { return error["message"] === "x"; }',
  'export function run(payload: Payload) { return String(payload).includes("busy"); }',
])("allows typed discrimination and non-error message fields: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source);
});

it("exempts test files", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    'it("fails", () => { try { run(); } catch (error) { expect(error.message.includes("boom")).toBe(true); } });',
    { filename: "sample.test.ts" },
  );
});
