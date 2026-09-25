import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-weak-test-assertions";
const testFile = { filename: "sample.test.ts" };

it("reports test files that only assert existence", async () => {
  await expect(
    assertRuleReports(ruleName, 'it("loads", () => { expect(load()).toBeDefined(); });\n', testFile),
  ).resolves.toBeUndefined();
});

it("reports test files that only assert truthiness", async () => {
  await expect(
    assertRuleReports(ruleName, 'it("loads", () => { expect(load()).toBeTruthy(); });\n', testFile),
  ).resolves.toBeUndefined();
});

it("allows snapshots of observable output", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'it("renders", () => { expect(render()).toMatchSnapshot(); });\n', testFile),
  ).resolves.toBeUndefined();
});

it("reports test files that only assert nothing throws", async () => {
  await expect(
    assertRuleReports(ruleName, 'it("runs", () => { expect(() => run()).not.toThrow(); });\n', testFile),
  ).resolves.toBeUndefined();
});

it("allows weak assertions alongside strong assertions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'it("loads", () => { expect(load()).toBeDefined(); expect(load()).toEqual({ id: 1 }); });\n',
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows throw expectations that pin the error", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'it("fails", () => { expect(() => run()).toThrow("boom"); });\n', testFile),
  ).resolves.toBeUndefined();
});

it("allows test files with only strong assertions", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'it("loads", () => { expect(load()).toBe(1); });\n', testFile),
  ).resolves.toBeUndefined();
});

it("ignores non-test files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export const check = () => expect(load()).toBeDefined();\n", {
      filename: "sample.ts",
    }),
  ).resolves.toBeUndefined();
});

it("counts property-test assertions as strong", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'it("roundtrips", () => { expect(setup()).toBeDefined(); fc.assert(fc.property(fc.string(), (s) => decode(encode(s)) === s)); });\n',
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it("does not let a property test certify a different weak test", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'it.prop("roundtrips", [arb], (s) => decode(encode(s)) === s); it("exists", () => { expect(api).toBeDefined(); });\n',
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it('reports regression: it("weak",()=>expect(load()).toBeDefined()); it("strong",()=>expect(1).toBe(1));', async () => {
  await assertRuleReports(
    ruleName,
    'it("weak",()=>expect(load()).toBeDefined()); it("strong",()=>expect(1).toBe(1));',
    { filename: "sample.test.ts" },
  );
});

it('reports regression: it("weak",()=>{ expect(load()).toBeDefined(); unrelated.toEqual(1); });', async () => {
  await assertRuleReports(ruleName, 'it("weak",()=>{ expect(load()).toBeDefined(); unrelated.toEqual(1); });', {
    filename: "sample.test.ts",
  });
});

it.each([
  'import { it as spec, expect as check } from "vitest"; spec("exists", () => check(load()).toBeDefined());',
  'import * as v from "vitest"; v.test.each([1])("exists", (value) => v.expect(value).toBeTruthy());',
  'import { test as spec, expect as check } from "vitest"; spec.skipIf(false)("exists", () => check(load()).toBeDefined());',
  'import { it, expect } from "vitest"; it.each([1])("exists", (value) => expect(value).toBeTruthy()); it("value", () => expect(1).toBe(1));',
])("recognizes aliased and parameterized weak tests: %s", async (source) => {
  await assertRuleReports(ruleName, source, testFile);
});

it.each([
  'import { it, expect } from "vitest"; function unrelated(expect: Function) { it("custom", () => expect(1).toBeTruthy()); }',
  'function it(name, run) { run(); } it("custom", () => expect(1).toBeTruthy());',
  'import * as v from "vitest"; v.test.each([1])("value", (value) => { v.expect(value).toBeTruthy(); v.expect(value).toBeGreaterThan(0); });',
  'import { it as spec, expect as check } from "vitest"; import { assert as invariant, property, integer } from "fast-check"; spec("property", () => { check(1).toBeTruthy(); invariant(property(integer(), (x) => x === x)); });',
])("respects shadows and observable or property assertions: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, testFile);
});

it("allows explicitly registered local assertion helpers", async () => {
  const source = 'it("contract", () => { expect(load()).toBeDefined(); assertValid(load()); });';
  await assertRuleReports(ruleName, source, testFile);
  await assertRuleDoesNotReport(ruleName, source, {
    ...testFile,
    ruleOptions: { assertionHelpers: ["assertValid"] },
  });
});

it("requires a property assertion to pin its value before treating it as behavioral evidence", async () => {
  await assertRuleReports(ruleName, 'it("exists", () => expect(load()).toHaveProperty("id"));', testFile);
  await assertRuleDoesNotReport(ruleName, 'it("value", () => expect(load()).toHaveProperty("id", 1));', testFile);
});

it.each([
  'it("passes", () => { expect(true).toBe(true); });',
  'it("passes", () => { expect(1).toBe(1); });',
  'it("passes", () => { const result = load(); expect(result).toEqual(result); });',
  'it("passes", () => { const result = load(); expect(result.id).toStrictEqual(result.id); });',
  'it("passes", () => { expect([1, "a"]).toEqual([1, "a"]); expect({ id: -1 }).toMatchObject({ id: -1 }); });',
  'it("passes", () => { expect(undefined).toBeUndefined(); expect(`ok`).toContain("o"); });',
])("treats tautological expects as weak: %s", async (source) => {
  await assertRuleReports(ruleName, source, testFile);
});

it.each([
  'it("adds", () => { expect(3).toBe(add(1, 2)); });',
  'it("copies", () => { const result = load(); expect(result.id).toBe(result.key); });',
  'it("advances", () => { expect(next()).not.toBe(next()); expect(next()).toBe(3); });',
  'it("keeps identity", () => { const input = build(); expect(normalize(input)).toBe(input); });',
  'it("passes", () => { expect(true).toBe(true); expect(load()).toEqual({ id: 1 }); });',
])("keeps real comparisons strong next to tautology near-misses: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, testFile);
});

it.each([
  'it("returns", () => { const fn = vi.fn().mockReturnValue(5); expect(fn()).toBe(5); });',
  'import { vi as mock, it, expect } from "vitest"; it("resolves", async () => { const fetchUser = mock.fn().mockResolvedValue({ id: 1 }); expect(await fetchUser()).toEqual({ id: 1 }); });',
])("treats assertions on a local mock's own result as weak: %s", async (source) => {
  await assertRuleReports(ruleName, source, testFile);
});

it.each([
  'it("delegates", () => { const fn = vi.fn().mockReturnValue(5); expect(run(fn)).toBe(5); });',
  'it("calls", () => { const fn = vi.fn(); run(fn); expect(fn).toHaveBeenCalledWith(1); });',
  'it("computes", () => { const fn = createAdder(2); expect(fn(1)).toBe(3); });',
])("keeps assertions on code that consumes a mock strong: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, testFile);
});

it.each([
  'it("saves", () => { run(save); expect(save).toHaveBeenCalledWith(expect.any(Object)); });',
  'it("loads", () => { expect(load()).toEqual(expect.anything()); });',
  'it("saves", () => { run(save); expect(save).toHaveBeenCalledWith(expect.anything(), expect.any(String)); });',
  'it("loads", () => { expect(load()).toMatchObject(expect.objectContaining({})); expect(list()).toEqual(expect.arrayContaining([])); });',
  'import { expect as check, it } from "vitest"; it("loads", () => { check(load()).toStrictEqual(check.any(Function)); });',
])("treats wildcard-only matcher arguments as weak: %s", async (source) => {
  await assertRuleReports(ruleName, source, testFile);
});

it.each([
  'it("saves", () => { run(save); expect(save).toHaveBeenCalledWith({ id: "o1" }); });',
  'it("saves", () => { run(save); expect(save).toHaveBeenCalledWith(expect.any(String), 30); });',
  'it("loads", () => { expect(load()).toEqual({ id: expect.any(String), total: 30 }); });',
  'it("loads", () => { expect(load()).toEqual(expect.any(Order)); });',
  'it("loads", () => { expect(load()).toEqual(expect.objectContaining({ id: "o1" })); expect(list()).toEqual(expect.arrayContaining([1])); });',
  'it("loads", () => { expect(load()).toEqual(matchers.anything()); });',
])("keeps matchers with one concrete expectation strong: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, testFile);
});

it.each([
  'it("notifies", () => { run(notify); expect(notify).toHaveBeenCalled(); });',
  'it("notifies", () => { run(notify); expect(notify).toBeCalled(); });',
  'it("builds", () => { expect(build()).toBeInstanceOf(Object); });',
  'it("exposes", () => { expect(typeof api.run).toBe("function"); });',
])("treats bare-call, Object-instance and typeof checks as weak: %s", async (source) => {
  await assertRuleReports(ruleName, source, testFile);
});

it.each([
  'it("stays quiet", () => { run(notify); expect(notify).not.toHaveBeenCalled(); });',
  'it("notifies", () => { run(notify); expect(notify).toHaveBeenCalled(); expect(notify).toHaveBeenCalledWith("o1"); });',
  'it("fails", () => { expect(build()).toBeInstanceOf(ValidationError); });',
  'it("describes", () => { expect(typeof api.run).toBe(describeKind(api)); });',
  'it("names", () => { expect(kindOf(api.run)).toBe("function"); });',
])("stays silent on bare-call, instance and typeof near-misses: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, testFile);
});

it("leaves a bare toThrow() to vitest/require-to-throw-message", async () => {
  await assertRuleDoesNotReport(ruleName, 'it("fails", () => { expect(() => run()).toThrow(); });', testFile);
});
