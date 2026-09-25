import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-test-sleeps";
const testFile = { filename: "sample.test.ts" };

it.each([
  'it("settles", async () => { start(); await new Promise((r) => setTimeout(r, 500)); expect(state()).toBe("done"); });',
  'it("settles", async () => { await new Promise<void>((resolve) => { setTimeout(() => resolve(), 50); }); });',
  'it("settles", async () => { await new Promise(function (done) { globalThis.setTimeout(() => { done(); }, 50); }); });',
  'import { setTimeout as sleep } from "node:timers/promises"; it("settles", async () => { await sleep(condition); });',
  'import { scheduler } from "timers/promises"; it("settles", async () => { await scheduler.wait(10); });',
  'import { sleep } from "./helpers"; it("settles", async () => { start(); await sleep(250); });',
  'it("settles", async () => { await delay(1_000); });',
])("reports wall-clock sleeps: %s", async (source) => {
  await assertRuleReports(ruleName, source, testFile);
});

it.each([
  'it("settles", async () => { await vi.waitFor(() => expect(state()).toBe("done")); });',
  'it("times out", async () => { const result = new Promise((resolve, reject) => setTimeout(() => reject(new Error("late")), 50)); await expect(result).rejects.toThrow("late"); });',
  'it("defers", async () => { await new Promise((resolve) => { setTimeout(() => { record(); resolve(undefined); }, 50); }); });',
  'it("defers", async () => { await new Promise((resolve) => queue.onIdle(resolve)); });',
  'it("debounces", async () => { vi.useFakeTimers(); const tick = new Promise((r) => setTimeout(r, 500)); vi.advanceTimersByTime(500); await tick; });',
  'it("waits", async () => { await wait(condition); await delay(); });',
  'it("schedules", () => { setTimeout(flush, 10); });',
  'import { setInterval } from "node:timers/promises"; import type { scheduler } from "node:timers/promises"; it("ticks", () => { expect(setInterval).toBeTypeOf("function"); });',
  'it("uses a local timer", async () => { const setTimeout = fakeTimer(); await new Promise((r) => setTimeout(r, 5)); });',
])("allows condition waits, fake timers, and timers under test: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, testFile);
});

it("ignores non-test files", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    "export const backoff = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));",
    { filename: "retry.ts" },
  );
});
