import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineTestExpectationDrift, testExpectationDrift } from "./rule.js";

type Repository = Readonly<Record<string, string>>;

const priceTest = (expected: string): string =>
  `import { lineTotal } from "./price.js";\n\nit("rounds half up", () => {\n  expect(lineTotal(cart)).toBe(${expected});\n});\n`;
const priceSource = (digits: number): string => `export const lineTotal = (cart) => round(cart.total, ${digits});\n`;

const orderTest = (assertion: string): string => `it("builds the order", () => {\n  ${assertion}\n});\n`;
const snapshotFile = (total: string): string => `exports[\`receipt 1\`] = \`\n"total: ${total}"\n\`;\n`;
const inlineSnapshotTest = (line: string): string =>
  `it("prints", () => {\n  expect(print(receipt)).toMatchInlineSnapshot(\`\n    header\n    a\n    b\n    c\n    d\n    ${line}\n  \`);\n});\n`;

async function kinds(before: Repository, after: Repository, rule = testExpectationDrift) {
  const findings = await testRuleOnChange({ rule: rule, fixture: { before, after } });
  return findings.map((finding) => [finding.file, finding.message.replace(/^.*\(([^)]*)\).*$/, "$1")]);
}

it("reports a re-valued expectation when source changed in the same change, on the hunk line", async () => {
  const findings = await testRuleOnChange({
    rule: testExpectationDrift,
    fixture: {
      before: { "src/price.ts": priceSource(2), "src/price.test.ts": priceTest("12.06") },
      after: { "src/price.ts": priceSource(3), "src/price.test.ts": priceTest("12.05") },
    },
  });
  expect(findings.map((finding) => [finding.file, finding.line, finding.authority, finding.lineageKey])).toEqual([
    ["src/price.test.ts", 1, "human", "src/price.test.ts"],
  ]);
  expect(findings[0]?.message).toBe(
    "Existing expectations changed here (expectation-revalued): point to the declared behaviour change, or restore the expectation and repair the code.",
  );
});

it("counts a .tsx source file as touched source", async () => {
  expect(
    await kinds(
      {
        "src/Price.tsx": "export const Price = () => <b>1</b>;\n",
        "src/price.test.ts": priceTest("12.06"),
      },
      {
        "src/Price.tsx": "export const Price = () => <b>2</b>;\n",
        "src/price.test.ts": priceTest("12.05"),
      },
    ),
  ).toEqual([["src/price.test.ts", "expectation-revalued"]]);
});

it("stays silent on the same literal flip when no source file is part of the change", async () => {
  expect(await kinds({ "src/price.test.ts": priceTest("12.06") }, { "src/price.test.ts": priceTest("12.05") })).toEqual(
    [],
  );
  expect(
    await kinds(
      { "src/price.test.ts": priceTest("12.06") },
      { "src/price.test.ts": priceTest("12.05"), "src/new-module.ts": "export const added = 1;\n" },
    ),
  ).toEqual([]);
});

it("reports a downgraded matcher and a gained wildcard without any source change", async () => {
  expect(
    await kinds(
      { "src/order.test.ts": orderTest('expect(order).toEqual({ id: "o1", total: 30 });') },
      { "src/order.test.ts": orderTest('expect(order).toMatchObject({ id: "o1" });') },
    ),
  ).toEqual([["src/order.test.ts", "matcher-downgraded"]]);
  expect(
    await kinds(
      { "src/order.test.ts": orderTest('expect(save).toHaveBeenCalledWith({ id: "o1" });') },
      { "src/order.test.ts": orderTest("expect(save).toHaveBeenCalledWith(expect.anything());") },
    ),
  ).toEqual([["src/order.test.ts", "matcher-downgraded"]]);
  expect(
    await kinds(
      { "src/order.test.ts": orderTest("expect(ratio).toBe(0.3);") },
      { "src/order.test.ts": orderTest("expect(ratio).toBeCloseTo(0.3);") },
    ),
  ).toEqual([["src/order.test.ts", "matcher-downgraded"]]);
});

it("stays silent when a matcher is strengthened", async () => {
  expect(
    await kinds(
      {
        "src/order.test.ts": 'it("builds", () => {\n  expect(order).toMatchObject({ id: "o1" });\n});\n',
      },
      {
        "src/order.test.ts": 'it("builds", () => {\n  expect(order).toStrictEqual({ id: "o1", total: 30 });\n});\n',
      },
    ),
  ).toEqual([]);
});

it("reports a deleted test block and a newly skipped test", async () => {
  const first = 'it("keeps the id", () => {\n  expect(order.id).toBe("o1");\n});\n';
  const second = 'it("rejects empty carts", () => {\n  expect(() => build([])).toThrow("empty");\n});\n';
  expect(await kinds({ "src/order.test.ts": first + second }, { "src/order.test.ts": first })).toEqual([
    ["src/order.test.ts", "assertion-removed, test-removed"],
  ]);
  expect(
    await kinds(
      { "src/order.test.ts": first + second },
      { "src/order.test.ts": first + second.replace("it(", "it.skip(") },
    ),
  ).toEqual([["src/order.test.ts", "disabled"]]);
});

it("reports a rewritten snapshot file and inline snapshot body only when source changed", async () => {
  const before = {
    "src/__snapshots__/receipt.test.ts.snap": snapshotFile("30"),
    "src/receipt.ts": "export const a = 1;\n",
  };
  expect(
    await kinds(before, {
      "src/__snapshots__/receipt.test.ts.snap": snapshotFile("31"),
      "src/receipt.ts": "export const a = 2;\n",
    }),
  ).toEqual([["src/__snapshots__/receipt.test.ts.snap", "snapshot-rewritten"]]);
  expect(
    await kinds(before, {
      ...before,
      "src/__snapshots__/receipt.test.ts.snap": snapshotFile("31"),
    }),
  ).toEqual([]);

  expect(
    await kinds(
      {
        "src/receipt.test.ts": inlineSnapshotTest("total 30"),
        "src/receipt.ts": "export const a = 1;\n",
      },
      {
        "src/receipt.test.ts": inlineSnapshotTest("total 31"),
        "src/receipt.ts": "export const a = 2;\n",
      },
    ),
  ).toEqual([["src/receipt.test.ts", "snapshot-rewritten"]]);
});

it("discounts an assertion moved verbatim between tests and between files", async () => {
  const before = `it("first", () => {\n  const order = build();\n  expect(order.total).toBe(30);\n  expect(order.id).toBe("o1");\n});\n\n\n\n\nit("second", () => {\n  const order = build();\n});\n`;
  const after = `it("first", () => {\n  const order = build();\n  expect(order.id).toBe("o1");\n});\n\n\n\n\nit("second", () => {\n  const order = build();\n  expect(order.total).toBe(30);\n});\n`;
  expect(await kinds({ "src/order.test.ts": before }, { "src/order.test.ts": after })).toEqual([]);

  const moved = 'it("keeps the total", () => {\n  expect(build().total).toBe(30);\n});\n';
  expect(
    await kinds(
      { "src/a.test.ts": `import "./a.js";\n${moved}`, "src/b.test.ts": 'import "./b.js";\n' },
      { "src/a.test.ts": 'import "./a.js";\n', "src/b.test.ts": `import "./b.js";\n${moved}` },
    ),
  ).toEqual([]);
});

it("does not let a moved line hide a second, genuinely removed copy", async () => {
  const line = "  expect(build().total).toBe(30);\n";
  expect(
    await kinds(
      {
        "src/a.test.ts": `it("a", () => {\n${line}${line}});\n`,
        "src/b.test.ts": 'it("b", () => {\n});\n',
      },
      {
        "src/a.test.ts": 'it("a", () => {\n});\n',
        "src/b.test.ts": `it("b", () => {\n${line}});\n`,
      },
    ),
  ).toEqual([["src/a.test.ts", "assertion-removed"]]);
});

it("stays silent on additions only, on added test files, and when a test goes away with its source", async () => {
  expect(
    await kinds(
      { "src/price.ts": priceSource(2), "src/price.test.ts": priceTest("12.06") },
      {
        "src/price.ts": priceSource(3),
        "src/price.test.ts": `${priceTest("12.06")}it("handles zero", () => {\n  expect(lineTotal(empty)).toBe(0);\n});\n`,
      },
    ),
  ).toEqual([]);
  expect(
    await kinds(
      { "src/price.ts": priceSource(2) },
      { "src/price.ts": priceSource(3), "src/price.test.ts": priceTest("1") },
    ),
  ).toEqual([]);
  expect(await kinds({ "src/foo.ts": "export const foo = 1;\n", "src/foo.test.ts": priceTest("1") }, {})).toEqual([]);
});

it("reports a test file deleted while its source stays", async () => {
  expect(
    await kinds(
      { "src/foo.ts": "export const foo = 1;\n", "src/foo.test.ts": priceTest("1") },
      { "src/foo.ts": "export const foo = 1;\n" },
    ),
  ).toEqual([["src/foo.test.ts", "assertion-removed, test-removed"]]);
});

it("keeps the fingerprint stable when unrelated lines shift the hunk", async () => {
  const before = { "src/price.ts": priceSource(2), "src/price.test.ts": priceTest("12.06") };
  const [first] = await testRuleOnChange({
    rule: testExpectationDrift,
    fixture: {
      before,
      after: { "src/price.ts": priceSource(3), "src/price.test.ts": priceTest("12.05") },
    },
  });
  const [second] = await testRuleOnChange({
    rule: testExpectationDrift,
    fixture: {
      before,
      after: {
        "src/price.ts": priceSource(3),
        "src/price.test.ts": `// moved\n${priceTest("12.05")}`,
      },
    },
  });
  expect(first?.fingerprint).toBeDefined();
  expect(second?.fingerprint).toStrictEqual(first?.fingerprint);
});

it("binds source files and snapshots so the engine keeps them in the change, and defaults to human authority", () => {
  expect(testExpectationDrift.binding.include).toEqual(["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}", "**/*.snap"]);
  expect(testExpectationDrift.binding.exclude).toEqual(["**/*.d.ts"]);
  expect(testExpectationDrift.binding.authority).toBe("human");
  expect(defineTestExpectationDrift({ authority: "agent" }).binding.authority).toBe("agent");
});

it("honours custom patterns, caps evidence and rejects an invalid cap", async () => {
  const rule = defineTestExpectationDrift({
    testFilePattern: /\.check\.ts$/g,
    assertionPattern: /\bverify\(/g,
  });
  const fixture = {
    before: { "src/a.check.ts": "run(() => {\n  verify(total, 30);\n});\n" },
    after: { "src/a.check.ts": "run(() => {\n});\n" },
  };
  expect(await testRuleOnChange({ rule: rule, fixture: fixture })).toHaveLength(1);
  expect(await testRuleOnChange({ rule: rule, fixture: fixture })).toHaveLength(1);
  expect(await testRuleOnChange({ rule: testExpectationDrift, fixture: fixture })).toEqual([]);
  expect(rule.binding.options).toEqual({
    authority: null,
    testFilePattern: { source: "\\.check\\.ts$", flags: "g" },
    assertionPattern: { source: "\\bverify\\(", flags: "g" },
    maxEvidenceLines: null,
  });
  expect(() => defineTestExpectationDrift({ maxEvidenceLines: 0 })).toThrow(
    "maxEvidenceLines must be a positive integer",
  );
});
