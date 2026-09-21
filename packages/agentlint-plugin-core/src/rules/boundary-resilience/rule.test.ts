import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { boundaryResilience, defineBoundaryResilience } from "./rule.js";

it("reports fetch calls without a timeout or signal", () => {
  const context = createContext();
  const visitors = createVisitors(boundaryResilience, context);

  visitors.call_expression?.(createNode("call_expression", 'fetch("https://example.com/api")'));

  expect(context.messages).toEqual([
    "Outbound call carries no visible timeout or AbortSignal; an unbounded call hangs the caller.",
  ]);
});

it("reports axios-style client calls without a timeout or signal", () => {
  const context = createContext();
  const visitors = createVisitors(boundaryResilience, context);

  visitors.call_expression?.(createNode("call_expression", "axios.post(url, payload)"));

  expect(context.messages).toHaveLength(1);
});

it("ignores fetch calls that pass an AbortSignal", () => {
  const context = createContext();
  const visitors = createVisitors(boundaryResilience, context);

  visitors.call_expression?.(createNode("call_expression", "fetch(url, { signal: controller.signal })"));

  expect(context.messages).toEqual([]);
});

it("ignores client calls that set a timeout", () => {
  const context = createContext();
  const visitors = createVisitors(boundaryResilience, context);

  visitors.call_expression?.(createNode("call_expression", "axios.get(url, { timeout: 5_000 })"));

  expect(context.messages).toEqual([]);
});

it("ignores non-network calls that merely start with fetch-like names", () => {
  const context = createContext();
  const visitors = createVisitors(boundaryResilience, context);

  visitors.call_expression?.(createNode("call_expression", "fetchUserFromCache(id)"));

  expect(context.messages).toEqual([]);
});

it("supports a custom network call pattern", () => {
  const rule = defineBoundaryResilience({ networkCallPattern: /^httpClient\./ });
  const context = createContext();
  const visitors = createVisitors(rule, context);

  visitors.call_expression?.(createNode("call_expression", "httpClient.get(url)"));

  expect(context.messages).toHaveLength(1);
});

const discardedFailure =
  "Handler around an outbound call discards the failure; rethrow it, branch on a named condition, or justify the silence with a REASON: comment.";

async function messages(source: string): Promise<readonly string[]> {
  return (await testRuleOnSource(boundaryResilience, source, "src/module.ts")).map((finding) => finding.message);
}

it("does not accept resilience words that only appear in a URL, string or comment", async () => {
  expect(await messages('fetch("/api/signal?timeout=30");')).toHaveLength(1);
  expect(await messages("fetch(url /* timeout: handled upstream */);")).toHaveLength(1);
  expect(await messages("const timeout = 5; fetch(url);")).toHaveLength(1);
});

it("accepts markers carried by the call arguments, including shorthand", async () => {
  expect(await messages("fetch(url, { signal });")).toEqual([]);
  expect(await messages("fetch(url, { method, signal, });")).toEqual([]);
  expect(await messages("axios.get(url, { timeout: 5_000 });")).toEqual([]);
  expect(await messages("fetch(url, { signal: AbortSignal.timeout(2_000) });")).toEqual([]);
});

it("reports a chained outbound call once, on the call that owns the arguments", async () => {
  expect(await messages("fetch(url).then((response) => response.json()).then(render);")).toHaveLength(1);
});

it("reports catch blocks around outbound calls that only log or return a default", async () => {
  expect(
    await messages("try { await fetch(url, { signal }); } catch (error) { console.error(error); return []; }"),
  ).toEqual([discardedFailure]);
  expect(await messages("try { await fetch(url, { signal }); } catch { return undefined; }")).toEqual([
    discardedFailure,
  ]);
  expect(
    await messages("try { await fetch(url, { signal }); } catch (error) { logger.warn('failed', error); }"),
  ).toEqual([discardedFailure]);
});

it("reports .catch callbacks on outbound calls that swallow the rejection", async () => {
  expect(await messages("fetch(url, { signal }).catch(() => null);")).toEqual([discardedFailure]);
  expect(await messages("fetch(url, { signal }).then(parse).catch((error) => { console.warn(error); });")).toEqual([
    discardedFailure,
  ]);
});

it("accepts handlers that rethrow, inspect the error, hand it on, or record a reason", async () => {
  expect(
    await messages("try { await fetch(url, { signal }); } catch (error) { throw new LoadError({ cause: error }); }"),
  ).toEqual([]);
  expect(
    await messages(
      "try { await fetch(url, { signal }); } catch (error) { if (isNotFound(error)) return undefined; throw error; }",
    ),
  ).toEqual([]);
  expect(
    await messages("try { await fetch(url, { signal }); } catch (error) { return Result.fail(toDomainError(error)); }"),
  ).toEqual([]);
  expect(
    await messages(
      "try { await fetch(url, { signal }); } catch {\n  // REASON: telemetry is best effort by contract\n  return undefined;\n}",
    ),
  ).toEqual([]);
  expect(await messages("fetch(url, { signal }).catch(reportToSentry);")).toEqual([]);
  expect(
    await messages("fetch(url, { signal }).catch((error) => { throw new LoadError({ cause: error }); });"),
  ).toEqual([]);
});

it("leaves catch blocks that guard no outbound call to other rules", async () => {
  expect(await messages("try { JSON.parse(raw); } catch { return undefined; }")).toEqual([]);
  expect(await messages("cache.read(key).catch(() => null);")).toEqual([]);
  expect(await messages("try { run(); } catch { /* REASON: x */ }\nfetch(url, { signal });")).toEqual([]);
});

it("rejects a REASON marker that carries no written reason", async () => {
  expect(
    await messages("try { await fetch(url, { signal }); } catch {\n  // REASON: ok\n  return undefined;\n}"),
  ).toEqual([discardedFailure]);
});
