import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "core/no-unsignaled-test-poll";
const testFile = { filename: "delivery.test.ts" };

it("reports expect.poll on a recorded collection's length, with the signal to await instead", async () => {
  const code = 'import { expect } from "vitest"; await expect.poll(() => app.attempts.length).toBe(2);';

  await expect(reportedMessages(ruleName, code, testFile)).resolves.toEqual([
    "Polling a spy or a recorded-call count races a deadline: it fails under CPU load, and a longer timeout only hides that. Await a signal instead: resolve a Promise.withResolvers() deferred (an Effect Deferred or Queue) where the call is recorded, or await the operation's own completion.",
  ]);
});

it("reports expect.poll on a recorder asserted with toHaveLength", async () => {
  await assertRuleReports(ruleName, "await expect.poll(() => sent).not.toHaveLength(0);", testFile);
});

it("reports expect.poll on a spy's mock state", async () => {
  await assertRuleReports(
    ruleName,
    "await expect.poll(() => { return onSave.mock.calls[0]; }).toEqual([1]);",
    testFile,
  );
});

it("reports vi.waitFor on a spy matcher", async () => {
  await assertRuleReports(ruleName, "await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));", testFile);
});

it("reports vi.waitFor on a recorder's length inside an Effect helper", async () => {
  const code =
    "const after = (count) => Effect.promise(() => vi.waitFor(() => { expect(app.attempts.length).toBeGreaterThanOrEqual(count); }));";

  await assertRuleReports(ruleName, code, testFile);
});

it("allows polling observable state read through a call", async () => {
  await assertRuleDoesNotReport(
    ruleName,
    'await vi.waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));',
    testFile,
  );
});

it("allows polling a plain value", async () => {
  await assertRuleDoesNotReport(ruleName, 'await expect.poll(() => status).toBe("ready");', testFile);
});

it("allows polling a rendered hook's current value", async () => {
  await assertRuleDoesNotReport(ruleName, "await expect.poll(() => result.current.items.length).toBe(2);", testFile);
});

it("allows a multi-statement callback it cannot judge", async () => {
  const code = "await vi.waitFor(() => { const count = requests.length; expect(count).toBe(1); });";

  await assertRuleDoesNotReport(ruleName, code, testFile);
});

it("ignores polls outside test files", async () => {
  await assertRuleDoesNotReport(ruleName, "await vi.waitFor(() => expect(post).toHaveBeenCalled());", {
    filename: "probe.ts",
  });
});
