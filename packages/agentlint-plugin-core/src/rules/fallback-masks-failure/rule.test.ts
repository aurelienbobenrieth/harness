import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineFallbackMasksFailure, fallbackMasksFailure } from "./rule.js";

const fallbackMessage =
  "Empty-literal fallback lets execution continue without the real value; reject absence at the boundary, or show that the default is the documented domain value.";
const catchMessage =
  "Error handler returns an empty literal, so callers cannot tell failure from an empty result; propagate the failure or return a typed error.";

async function messages(
  source: string,
  file = "src/module.ts",
  rule = fallbackMasksFailure,
): Promise<readonly string[]> {
  return (await testRuleOnSource({ rule: rule, source: source, file: file })).map((finding) => finding.message);
}

it("reports a single fallback on a value whose name marks required data", async () => {
  expect(await messages('const id = params.id ?? "";')).toEqual([fallbackMessage]);
  expect(await messages("const price = item.unitPrice ?? 0;")).toEqual([fallbackMessage]);
  expect(await messages('const email = form.get("email") || "";')).toEqual([fallbackMessage]);
  expect(await messages('const token = headers["x-api-token"] ?? "unknown";')).toEqual([fallbackMessage]);
  expect(await messages("const total = (await loadOrder(ref))!.lineTotal || 0;")).toEqual([fallbackMessage]);
});

it("matches whole name segments, not substrings", async () => {
  expect(await messages("const width = layout.width ?? 0;")).toEqual([]);
  expect(await messages('const provider = config.provider ?? "";')).toEqual([]);
  expect(await messages("const valid = result.validations || [];")).toEqual([]);
  expect(await messages('const discount = cart.discountLabel ?? "";')).toEqual([]);
});

it("reports once per function when ordinary fallbacks pile up, and keeps functions apart", async () => {
  const dense = `
function normalize(input) {
  const label = input.label ?? "";
  const tags = input.tags || [];
  const meta = input.meta ?? {};
  return { label, tags, meta };
}`;
  const findings = await testRuleOnSource({
    rule: fallbackMasksFailure,
    source: dense,
    file: "src/module.ts",
  });
  expect(findings.map((finding) => finding.message)).toEqual([fallbackMessage]);

  const spread = `
function first(input) { return input.label ?? ""; }
function second(input) { return input.tags || []; }
const third = (input) => input.meta ?? {};`;
  expect(await messages(spread)).toEqual([]);
});

it("stays silent on a lone ordinary default and on non-empty or computed fallbacks", async () => {
  expect(await messages('const label = input.label ?? "";')).toEqual([]);
  expect(await messages('const id = params.id ?? crypto.randomUUID(); const key = params.key ?? "primary";')).toEqual(
    [],
  );
  expect(await messages("const id = params.id ?? fail(); const count = params.count ?? 10;")).toEqual([]);
  expect(await messages("const id = params.id && 0; const key = params.key ?? [fallbackKey];")).toEqual([]);
  expect(await messages("const total = a.total + 0; const url = `${base}` ?? `${other}`;")).toEqual([]);
});

it("treats JSX output as a display default", async () => {
  const component = `
export function Badge({ user }) {
  return <span title={user.email ?? ""}>{user.id ?? ""}{user.nickname || "unknown"}</span>;
}`;
  expect(await messages(component, "src/badge.tsx")).toEqual([]);

  const computedBeforeRender = `
export function Badge({ user }) {
  const id = user.id ?? "";
  return <span>{id}</span>;
}`;
  expect(await messages(computedBeforeRender, "src/badge.tsx")).toEqual([fallbackMessage]);
});

it("reports parameter and destructuring defaults only for required-looking names", async () => {
  expect(await messages('function charge(amount = 0, currency = "") {}')).toEqual([fallbackMessage]);
  expect(await messages('const { customerId = "" } = payload;')).toEqual([fallbackMessage]);
  expect(await messages('function render(items = [], { title = "", tags = [] } = {}) {}')).toEqual([]);
  expect(await messages("function page(limit = 20, amount = 5) {}")).toEqual([]);
});

it("reports error handlers that answer a failure with an empty literal", async () => {
  expect(await messages("function load() { try { return JSON.parse(raw); } catch { return {}; } }")).toEqual([
    catchMessage,
  ]);
  expect(
    await messages(
      "async function list() { try { return await repo.all(); } catch (error) { console.error(error); return []; } }",
    ),
  ).toEqual([catchMessage]);
  expect(await messages("const rows = await query(sql).catch(() => []);")).toEqual([catchMessage]);
  expect(
    await messages("const row = await query(sql).catch((error) => { logger.warn(error); return null; });"),
  ).toEqual([catchMessage]);
});

it("accepts handlers that rethrow, branch on the error, return a real value, or record a reason", async () => {
  expect(
    await messages(
      "function load() { try { return read(); } catch (error) { if (isMissing(error)) return []; throw error; } }",
    ),
  ).toEqual([]);
  expect(
    await messages("function load() { try { return read(); } catch (error) { return Result.fail(error); } }"),
  ).toEqual([]);
  expect(
    await messages(
      "function load() { try { return read(); } catch (error) { return error instanceof Missing ? [] : [error]; } }",
    ),
  ).toEqual([]);
  expect(
    await messages(
      "function exists() { try { stat(path); return true; } catch {\n  // REASON: absence of the file is the negative answer\n  return undefined;\n} }",
    ),
  ).toEqual([]);
  expect(
    await messages("function run() { try { work(); } catch { items.forEach(() => { return []; }); cleanup(); } }"),
  ).toEqual([]);
  expect(await messages("const rows = await query(sql).catch(toDomainError);")).toEqual([]);
});

it("scopes test files out of the default binding", () => {
  expect(fallbackMasksFailure.binding.exclude).toEqual(["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"]);
});

it("takes a replacement name list and a density threshold", async () => {
  const rule = defineFallbackMasksFailure({ sensitiveNames: ["slug"], minFallbacksPerScope: 3 });
  expect(await messages('const slug = route.slug ?? "";', "src/module.ts", rule)).toEqual([fallbackMessage]);
  expect(await messages('const id = params.id ?? ""; const tags = input.tags || [];', "src/module.ts", rule)).toEqual(
    [],
  );
  expect(() => defineFallbackMasksFailure({ minFallbacksPerScope: 0 })).toThrow("positive integer");
});

it("attaches every fallback of the function as evidence", async () => {
  const findings = await testRuleOnSource({
    rule: fallbackMasksFailure,
    source: 'function f(input) { const a = input.label ?? ""; const b = input.orderId ?? ""; }',
    file: "src/module.ts",
  });
  expect(findings).toHaveLength(1);
  expect(JSON.stringify(findings[0])).toContain("input.orderId");
});
