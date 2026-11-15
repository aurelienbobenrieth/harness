import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-let";

it("reports let declarations", async () => {
  await expect(assertRuleReports(ruleName, "let total = 0;\ntotal += 1;\n")).resolves.toBeUndefined();
});

it("reports var declarations", async () => {
  await expect(assertRuleReports(ruleName, "var total = 0;\ntotal += 1;\n")).resolves.toBeUndefined();
});

it("reports let declarations in loop heads", async () => {
  await expect(
    assertRuleReports(ruleName, "for (let index = 0; index < 3; index += 1) {\n  run(index);\n}\n"),
  ).resolves.toBeUndefined();
});

it("allows const declarations", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "const total = 0;\nexport { total };\n")).resolves.toBeUndefined();
});

const forHeaders = [
  "for (let index = 0; index < 3; index += 1) {\n  run(index);\n}\n",
  "for (let item of items) {\n  run(item);\n}\n",
  "for (let key in record) {\n  run(key);\n}\n",
];

it.each(forHeaders)("allows a let in a for header with allowForLoopHeaders: %s", async (source) => {
  await expect(
    assertRuleDoesNotReport(ruleName, source, { ruleOptions: { allowForLoopHeaders: true } }),
  ).resolves.toBeUndefined();
});

it("still reports a let in the loop body and a var header with allowForLoopHeaders", async () => {
  await expect(
    assertRuleReports(ruleName, "for (const item of items) {\n  let total = 0;\n  total += item;\n}\n", {
      ruleOptions: { allowForLoopHeaders: true },
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "for (var index = 0; index < 3; index += 1) {}\n", {
      ruleOptions: { allowForLoopHeaders: true },
    }),
  ).resolves.toBeUndefined();
});

const branchInits = [
  "let label;\nif (ready) {\n  label = 'a';\n} else {\n  label = 'b';\n}\nuse(label);\n",
  "let label;\nif (a) label = 'a';\nelse if (b) label = 'b';\nelse label = 'c';\nuse(label);\n",
  "let label: string;\nswitch (kind) {\n  case 'x':\n    label = 'a';\n    break;\n  case 'y':\n  case 'z':\n    label = 'b';\n    break;\n  default:\n    label = 'c';\n}\nuse(label);\n",
  "let label;\nif (ready) {\n  label = 'a';\n} else {\n  throw new Error('no');\n}\nuse(label);\n",
];

it.each(branchInits)("allows init-in-branch with allowBranchInitialization: %s", async (source) => {
  await expect(
    assertRuleDoesNotReport(ruleName, source, { ruleOptions: { allowBranchInitialization: true } }),
  ).resolves.toBeUndefined();
});

const notBranchInits = [
  "let label;\nif (ready) {\n  label = 'a';\n}\nuse(label);\n",
  "let label;\nif (ready) {\n  label = 'a';\n} else {\n  label = 'b';\n}\nlabel = 'c';\n",
  "let label;\nif (ready) {\n  label = 'a';\n  label = 'x';\n} else {\n  label = 'b';\n}\n",
  "let label = 'a';\nif (ready) {\n  label = 'b';\n} else {\n  label = 'c';\n}\n",
  "let label;\nswitch (kind) {\n  case 'x':\n    label = 'a';\n    break;\n}\nuse(label);\n",
  "let total = 0;\ntotal += 1;\n",
];

it.each(notBranchInits)("reports other lets with allowBranchInitialization: %s", async (source) => {
  await expect(
    assertRuleReports(ruleName, source, { ruleOptions: { allowBranchInitialization: true } }),
  ).resolves.toBeUndefined();
});

it("reports both forms by default", async () => {
  await expect(
    assertRuleReports(ruleName, "let label;\nif (a) {\n  label = 1;\n} else {\n  label = 2;\n}\nuse(label);\n"),
  ).resolves.toBeUndefined();
});
