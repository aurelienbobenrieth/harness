import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-discarded-caught-error";

it.each([
  "export async function read(id: string) { try { return await load(id); } catch { return undefined; } }",
  "export async function run() { try { await sync(); } catch (error) { console.error(error); return []; } }",
  'export async function run() { try { await sync(); } catch (error) { logger.warn("sync failed", { message: error.message }); } }',
  "export class Job { async run() { try { await sync(); } catch (error) { this.logger.error(`failed: ${error}`); } } }",
  "export const result = promise.catch(() => null);",
  "export const result = promise.then((value) => value, (error) => { console.warn(error); return 0; });",
  "export function run() { try { sync(); } catch { /* ignore */ } }",
  "export function run() { try { sync(); } catch {\n // REASON: todo explain this later\n return false; } }",
  "export function run() { try { sync(); } catch {\n // REASON: ok\n return false; } }",
  'export function run() { try { sync(); } catch { const fail = () => { throw new Error("later"); }; return fail; } }',
])("reports handlers that discard the failure: %s", async (source) => {
  await assertRuleReports(ruleName, source);
});

it.each([
  "export async function read(id: string) { try { return await load(id); } catch (error) { throw new LoadError({ id, cause: error }); } }",
  "export async function read() { try { return await load(); } catch (error) { if (isNotFound(error)) return undefined; throw error; } }",
  "export async function read() { try { return await load(); } catch (error) { return { ok: false, error }; } }",
  "export async function read() { try { return await load(); } catch (error) { if (error instanceof NotFound) return undefined; return fallback; } }",
  "export async function read() { try { return await load(); } catch (error) { console.error(error); report(error); return undefined; } }",
  "export function probe() { try { access(path); return true; } catch { /* REASON: probe only; absence of the file is the negative answer */ return false; } }",
  "export function probe() { try { access(path); return true; } catch {\n // REASON: a missing file is the negative answer here\n return false; } }",
  "export function run() { try { sync(); } catch {} }",
  "export const result = promise.catch((error) => Promise.reject(wrap(error)));",
  "export const result = promise.catch(() => Promise.reject(new SyncError()));",
  "export const result = promise.catch((error: unknown) => toFailure(error));",
  "export const result = promise.catch(handleFailure);",
  "// REASON: telemetry is best effort and must never fail the request\nvoid send(event).catch(() => undefined);",
  "export const result = send(event).catch(/* REASON: telemetry is best effort by contract */ () => undefined);",
  "export const program = Effect.catch(() => Effect.succeed(0));",
  "export function run() { try { sync(); } catch ({ message }) { return message; } }",
])("allows handlers that rethrow, inspect, or justify: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source);
});

it("exempts test files unless includeTestFiles is set", async () => {
  const source = "export function run() { try { sync(); } catch { return undefined; } }";
  await assertRuleDoesNotReport(ruleName, source, { filename: "sample.test.ts" });
  await assertRuleReports(ruleName, source, {
    filename: "sample.test.ts",
    ruleOptions: { includeTestFiles: true },
  });
});

it("honours a custom reason marker and custom log-only callees", async () => {
  const reasoned = "export function run() { try { sync(); } catch { /* WHY: shutdown hooks are best effort */ } }";
  await assertRuleReports(ruleName, reasoned);
  await assertRuleDoesNotReport(ruleName, reasoned, { ruleOptions: { reasonMarker: "WHY" } });

  const logged = "export function run() { try { sync(); } catch (error) { audit.record(error); } }";
  await assertRuleDoesNotReport(ruleName, logged);
  await assertRuleReports(ruleName, logged, { ruleOptions: { logOnlyCallees: ["audit"] } });
});
