import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, fixCode } from "../test-support.ts";

const ruleName = "core/padding-line-between-statements";

type Sample = {
  readonly type: string;
  readonly matching: readonly string[];
  readonly other: readonly string[];
};

/**
 * Each snippet is the previous statement; `x;` follows it without a blank line, so under
 * `{ blankLine: "always", prev: <type>, next: "*" }` the rule pads exactly when the snippet has that type.
 */
const samples: readonly Sample[] = [
  { type: "*", matching: ["a;", "class A {}"], other: [] },
  {
    type: "block-like",
    matching: [
      "if (a) {}",
      "if (a) {} else {}",
      "const f = () => {};",
      "export function f() {}",
      "(function () {})();",
      "do {} while (a);",
      "switch (a) {}",
      "try {} catch {}",
      "{}",
    ],
    other: ["class A {}", "if (a) b();", "const o = {};", "foo(() => {});", "do a(); while (b);"],
  },
  { type: "multiline-block-like", matching: ["if (a) {\n}"], other: ["if (a) {}", "a(\n);"] },
  { type: "block", matching: ["{}"], other: ["if (a) {}"] },
  { type: "empty", matching: [";"], other: ["a;"] },
  { type: "expression", matching: ["a();", '("use strict");'], other: ["const a = 1;", "if (a) {}"] },
  { type: "multiline-expression", matching: ["a(\n);", "a\n  .b();"], other: ["a();", "if (a) {\n}"] },
  { type: "directive", matching: ['"use strict";'], other: ['("use strict");', "a();"] },
  { type: "const", matching: ["const a = 1;", "const a = {\n};"], other: ["export const a = 1;", "let a;"] },
  { type: "let", matching: ["let a;"], other: ["const a = 1;"] },
  { type: "var", matching: ["var a;"], other: ["let a;"] },
  { type: "multiline-const", matching: ["const a = {\n};"], other: ["const a = 1;"] },
  { type: "singleline-const", matching: ["const a = 1;"], other: ["const a = {\n};"] },
  { type: "multiline-let", matching: ["let a = {\n};"], other: ["let a;"] },
  { type: "singleline-let", matching: ["let a;"], other: ["let a = {\n};"] },
  { type: "multiline-var", matching: ["var a = {\n};"], other: ["var a;"] },
  { type: "singleline-var", matching: ["var a;"], other: ["var a = {\n};"] },
  { type: "if", matching: ["if (a) b();", "if (a) {}"], other: ["a();"] },
  {
    type: "for",
    matching: ["for (;;) {}", "for (const k in o) {}", "for (const v of o) {}", "label: for (;;) {}"],
    other: ["while (a) {}"],
  },
  { type: "while", matching: ["while (a) {}"], other: ["do {} while (a);"] },
  { type: "do", matching: ["do {} while (a);"], other: ["while (a) {}"] },
  { type: "try", matching: ["try {} finally {}"], other: ["{}"] },
  { type: "switch", matching: ["switch (a) {}"], other: ["if (a) {}"] },
  { type: "throw", matching: ["throw a;"], other: ["a();"] },
  { type: "function", matching: ["function f() {}", "async function f() {}"], other: ["const f = function () {};"] },
  { type: "class", matching: ["class A {}"], other: ["export class A {}"] },
  { type: "import", matching: ['import a from "a";'], other: ["a();"] },
  { type: "export", matching: ["export const a = 1;", "export {};"], other: ["const a = 1;"] },
  { type: "iife", matching: ["(function () {})();", "!function () {}();", "(() => {})();"], other: ["a();"] },
  { type: "debugger", matching: ["debugger;"], other: ["a();"] },
];

/** Types that only occur inside a function, a loop or a switch, each wrapped so it parses. */
const wrapped: readonly (readonly [type: string, code: string, output: string])[] = [
  ["return", "function f() {\n  return;\n  x;\n}\n", "function f() {\n  return;\n\n  x;\n}\n"],
  ["break", "for (;;) {\n  break;\n  x;\n}\n", "for (;;) {\n  break;\n\n  x;\n}\n"],
  ["continue", "for (;;) {\n  continue;\n  x;\n}\n", "for (;;) {\n  continue;\n\n  x;\n}\n"],
  ["case", "switch (a) {\n  case 1:\n  default:\n}\n", "switch (a) {\n  case 1:\n\n  default:\n}\n"],
  ["default", "switch (a) {\n  default:\n  case 1:\n}\n", "switch (a) {\n  default:\n\n  case 1:\n}\n"],
];

const optionsFor = (type: string) => ({ ruleOptionList: [{ blankLine: "always", prev: type, next: "*" }] });

describe("a statement type matches its statements", () => {
  it.each(samples.flatMap(({ type, matching }) => matching.map((code) => [type, code] as const)))(
    "%s matches %j",
    async (type, code) => {
      await expect(fixCode(ruleName, `${code}\nx;\n`, "fix", optionsFor(type))).resolves.toBe(`${code}\n\nx;\n`);
    },
  );

  it.each(wrapped)("%s matches in %j", async (type, code, output) => {
    await expect(fixCode(ruleName, code, "fix", optionsFor(type))).resolves.toBe(output);
  });

  it("with matches in a script", async () => {
    await expect(
      fixCode(ruleName, "with (a) {}\nx;\n", "fix", { ...optionsFor("with"), filename: "sample.cjs" }),
    ).resolves.toBe("with (a) {}\n\nx;\n");
  });
});

describe("a statement type skips other statements", () => {
  it.each(samples.flatMap(({ type, other }) => other.map((code) => [type, code] as const)))(
    "%s skips %j",
    async (type, code) => {
      await expect(assertRuleDoesNotReport(ruleName, `${code}\nx;\n`, optionsFor(type))).resolves.toBeUndefined();
    },
  );
});
