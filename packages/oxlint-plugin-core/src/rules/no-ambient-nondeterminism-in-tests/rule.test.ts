import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-ambient-nondeterminism-in-tests";
const testFile = { filename: "src/invoice.test.ts" };

it.each([
  'it("formats", () => { expect(format(total)).toBe(total.toLocaleString()); });',
  'it("formats", () => { expect(label(date)).toBe(date.toLocaleDateString(undefined, { dateStyle: "long" })); });',
  'it("formats", () => { expect(clock(date)).toBe(date.toLocaleTimeString()); });',
  'it("sorts", () => { expect(sortNames(names)).toEqual(names.toSorted((a, b) => a.localeCompare(b))); });',
  'it("formats", () => { expect(format(1)).toBe(new Intl.NumberFormat().format(1)); });',
  'it("formats", () => { expect(format(date)).toBe(Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date)); });',
])("reports locale-sensitive calls without a locale: %s", async (source) => {
  await assertRuleReports(ruleName, source, testFile);
});

it.each([
  'it("formats", () => { expect(format(total)).toBe(total.toLocaleString("en-US")); });',
  'it("sorts", () => { expect(sortNames(names)).toEqual(names.toSorted((a, b) => a.localeCompare(b, "en"))); });',
  'it("formats", () => { expect(format(1)).toBe(new Intl.NumberFormat("fr-FR").format(1)); });',
  'it("formats", () => { expect(format(1)).toBe(new Intl.NumberFormat(locale).format(1)); });',
  'it("lists", () => { expect(Intl.supportedValuesOf("currency")).toContain("EUR"); });',
  'it("formats", () => { expect(total.toString()).toBe("30"); });',
])("stays silent once the locale is explicit: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, testFile);
});

it.each([
  'it("stamps", () => { expect(stamp().createdAt).toEqual(new Date()); });',
  'it("stamps", () => { expect(stamp().createdAt).toBeLessThanOrEqual(Date.now()); });',
  'it("measures", () => { const start = performance.now(); run(); expect(performance.now() - start).toBeLessThan(50); });',
])("reports real clock reads: %s", async (source) => {
  await assertRuleReports(ruleName, source, testFile);
});

it.each([
  'it("stamps", () => { vi.useFakeTimers(); vi.setSystemTime(new Date("2024-01-01")); expect(stamp().createdAt).toEqual(new Date()); });',
  'import { vi as mock } from "vitest"; beforeEach(() => { mock.setSystemTime(0); }); it("stamps", () => { expect(stamp()).toBe(Date.now()); });',
  'it("parses", () => { expect(parse("2024-01-01")).toEqual(new Date("2024-01-01")); });',
  'it("ticks", () => { const clock = { now: () => 5 }; expect(read(clock)).toBe(clock.now()); });',
  'it("stamps", () => { const Date = FixedDate; expect(stamp(Date)).toEqual(new Date()); });',
])("stays silent when time is controlled or fixed: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source, testFile);
});

it("lets allowClock waive clock reads but not locale or randomness", async () => {
  const ruleOptions = { allowClock: true };
  await assertRuleDoesNotReport(ruleName, 'it("stamps", () => { expect(stamp()).toBe(Date.now()); });', {
    ...testFile,
    ruleOptions,
  });
  await assertRuleReports(ruleName, 'it("picks", () => { expect(pick(Math.random())).toBe(1); });', {
    ...testFile,
    ruleOptions,
  });
});

it("reports Math.random() and ignores seeded or local generators", async () => {
  await assertRuleReports(ruleName, 'it("picks", () => { expect(pick(Math.random())).toBeLessThan(1); });', testFile);
  await assertRuleDoesNotReport(
    ruleName,
    'it("picks", () => { const rng = seeded(42); expect(pick(rng.random())).toBe(3); });',
    testFile,
  );
  await assertRuleDoesNotReport(
    ruleName,
    'it("picks", () => { const Math = { random: () => 0.5 }; expect(pick(Math.random())).toBe(3); });',
    testFile,
  );
});

it("ignores non-test files", async () => {
  await assertRuleDoesNotReport(ruleName, "export const stamp = () => ({ at: Date.now(), id: Math.random() });", {
    filename: "src/invoice.ts",
  });
});
