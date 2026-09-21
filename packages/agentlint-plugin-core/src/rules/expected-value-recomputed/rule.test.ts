import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineExpectedValueRecomputed, expectedValueRecomputed } from "./rule.js";

const wrap = (body: string, head = ""): string => `${head}\nit("case", async () => {\n${body}\n});\n`;

async function evidence(source: string, file = "src/pricing.test.ts", rule = expectedValueRecomputed) {
  return (await testRuleOnSource(rule, source, file)).map((finding) => finding.line);
}

it("reports arithmetic, pipelines and string derivations that reuse the subject's inputs", async () => {
  expect(await evidence(wrap("expect(applyDiscount(price, pct)).toBe(price - (price * pct) / 100);"))).toEqual([3]);
  expect(
    await evidence(
      wrap(
        "const expected = items.reduce((sum, item) => sum + item.price, 0) * (1 + TAX);\nexpect(total(items)).toBe(expected);",
      ),
    ),
  ).toEqual([4]);
  expect(await evidence(wrap('expect(slugify(title)).toBe(title.toLowerCase().replace(/ +/g, "-"));'))).toEqual([3]);
  expect(await evidence(wrap("expect(await label(first, last)).not.toEqual(`${first} ${last}`);"))).toEqual([3]);
});

it("reports an expected value produced by a helper of the subject's own module", async () => {
  const head = 'import { total, taxFor } from "./pricing.js";\nimport { sum } from "./math.js";';
  expect(await evidence(wrap("expect(total(cart)).toBe(100 + taxFor(100) * rate);", head))).toEqual([4]);
  expect(await evidence(wrap("expect(total(cart)).toBe(sum(prices) * rate);", head))).toEqual([]);
});

it("stays silent on stated values, asymmetric matchers and property bodies", async () => {
  expect(await evidence(wrap("expect(applyDiscount(200, 15)).toBe(170);"))).toEqual([]);
  expect(await evidence(wrap("expect(total(items)).toEqual(expect.any(Number));"))).toEqual([]);
  expect(
    await evidence(
      wrap("fc.assert(fc.property(fc.integer(), (price) => { expect(double(price)).toBe(price * 2); }));"),
    ),
  ).toEqual([]);
  expect(
    await evidence('it.prop([fc.integer()])("doubles", (price) => { expect(double(price)).toBe(price * 2); });'),
  ).toEqual([]);
});

it("stays silent on literal arithmetic, a single substitution, and computations sharing no input", async () => {
  expect(await evidence(wrap("expect(ttl(now)).toBe(60 * 60 * 1000);"))).toEqual([]);
  expect(await evidence(wrap("expect(build(id)).toBe(`${baseUrl}/x`);"))).toEqual([]);
  expect(await evidence(wrap("expect(build(id)).toBe(`${baseUrl}/${version}/x`);"))).toEqual([]);
  expect(await evidence(wrap("expect(total(items)).toBe(base * rate);"))).toEqual([]);
  expect(await evidence(wrap("expect(order.total).toBe(price * quantity);"))).toEqual([]);
});

it("ignores non-test files and caps findings per file", async () => {
  const line = "expect(applyDiscount(price, pct)).toBe(price - pct);";
  expect(await evidence(wrap(line), "src/pricing.ts")).toEqual([]);
  expect(await evidence(wrap([line, line, line, line].join("\n")))).toEqual([3, 4, 5]);
  expect(
    await evidence(
      wrap([line, line].join("\n")),
      "src/a.test.ts",
      defineExpectedValueRecomputed({ maxFindingsPerFile: 1 }),
    ),
  ).toEqual([3]);
});

it("honours custom matchers and derivation callees, and mirrors options into the binding", async () => {
  const rule = defineExpectedValueRecomputed({ matcherPattern: /^toBeSameAs$/g, derivationCallees: ["padStart"] });
  const source = wrap(
    'expect(format(code)).toBeSameAs(code.padStart(4, "0"));\nexpect(format(code)).toBeSameAs(code.padStart(4, "0"));',
  );
  expect(await evidence(source, "src/a.test.ts", rule)).toEqual([3, 4]);
  expect(await evidence(source)).toEqual([]);
  expect(rule.binding.options).toEqual({
    matcherPattern: { source: "^toBeSameAs$", flags: "g" },
    derivationCallees: ["padStart"],
    maxFindingsPerFile: null,
  });
  expect(() => defineExpectedValueRecomputed({ maxFindingsPerFile: 0 })).toThrow("must be a positive integer");
});
