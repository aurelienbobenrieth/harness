import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, fixCode, lintCode, reportedMessages } from "../test-support.ts";

const ruleName = "core/padding-line-between-statements";
const expected = "Add a blank line above this statement and its leading comments.";
const unexpected = "Remove the blank lines between this statement and the one above it.";

/** The configuration the rule applies when it gets no options, written out as options. */
const recommended = [
  { blankLine: "always", prev: "*", next: ["block-like", "multiline-expression"] },
  { blankLine: "always", prev: ["block-like", "multiline-expression"], next: "*" },
  { blankLine: "always", prev: ["const", "let"], next: "*" },
  { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
  { blankLine: "always", prev: "*", next: ["return", "throw"] },
];
const always = [{ blankLine: "always", prev: "*", next: "*" }];
const never = [{ blankLine: "never", prev: "*", next: "*" }];

const fix = (code: string, options?: readonly unknown[]): Promise<string> =>
  fixCode(ruleName, code, "fix", options === undefined ? {} : { ruleOptionList: options });

const motivating = [
  "const program = Effect.gen(function* () {",
  "  const runtime = yield* workerRuntime;",
  "  // comment",
  "  if (runtime.planning) {",
  "    return;",
  "  }",
  "  yield* runtime.withConfig(X);",
  "});",
  "",
].join("\n");

describe("without options: blocks, multiline expressions, declaration runs and exits stand apart", () => {
  it("reports the motivating case twice with the padding message", async () => {
    await expect(reportedMessages(ruleName, motivating)).resolves.toEqual([expected, expected]);
  });

  it("pads the motivating case above the comment and below the block", async () => {
    await expect(fix(motivating)).resolves.toBe(
      [
        "const program = Effect.gen(function* () {",
        "  const runtime = yield* workerRuntime;",
        "",
        "  // comment",
        "  if (runtime.planning) {",
        "    return;",
        "  }",
        "",
        "  yield* runtime.withConfig(X);",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("applies the same configuration as the recommended options written out", async () => {
    await expect(fix(motivating, recommended)).resolves.toBe(await fix(motivating));
  });

  it.each([
    [
      "keeps a trailing same-line comment on its statement",
      "const a = 1; // why\nfoo();\n",
      "const a = 1; // why\n\nfoo();\n",
    ],
    [
      "keeps several trailing comments and moves the leading one down",
      "const a = 1; /* one */ /* two */\n// lead\nfoo();\n",
      "const a = 1; /* one */ /* two */\n\n// lead\nfoo();\n",
    ],
    [
      "pads inside a function body",
      "function f() {\n  const a = 1;\n  a();\n}\n",
      "function f() {\n  const a = 1;\n\n  a();\n}\n",
    ],
    ["pads before a return", "function f() {\n  a();\n  return;\n}\n", "function f() {\n  a();\n\n  return;\n}\n"],
    [
      "checks the statements of a switch case",
      "switch (x) {\n  case 1:\n    a();\n    throw e;\n  default:\n    b();\n}\n",
      "switch (x) {\n  case 1:\n    a();\n\n    throw e;\n  default:\n    b();\n}\n",
    ],
    [
      "checks a static block",
      "class A {\n  static {\n    const a = 1;\n    a();\n  }\n}\n",
      "class A {\n  static {\n    const a = 1;\n\n    a();\n  }\n}\n",
    ],
    [
      "checks a TypeScript module block",
      "namespace N {\n  const a = 1;\n  a();\n}\n",
      "namespace N {\n  const a = 1;\n\n  a();\n}\n",
    ],
    ["pads around a multiline expression", "a();\nfoo(\n  1,\n);\nb();\n", "a();\n\nfoo(\n  1,\n);\n\nb();\n"],
    ["keeps CRLF line breaks", "const a = 1;\r\n// lead\r\nfoo();\r\n", "const a = 1;\r\n\r\n// lead\r\nfoo();\r\n"],
  ])("%s", async (_name, code, output) => {
    await expect(fix(code)).resolves.toBe(output);
  });

  it("reaches a fixed point after one pass", async () => {
    const once = await fix(motivating);
    await expect(fix(once)).resolves.toBe(once);
  });

  it.each([
    ["consecutive declarations", "const a = 1;\nlet b = 2;\nconst c = a + b;\n\nfoo(c);\n"],
    ["the first statement of a block", "function f() {\n  return 1;\n}\n\nif (x) {\n  // why\n  return;\n}\n"],
    ["a blank line below the leading comments", "const a = 1;\n// lead\n\nfoo();\n"],
    ["single-line expressions in a row", "a();\nb();\nc();\n"],
  ])("stays silent on %s", async (_name, code) => {
    await expect(assertRuleDoesNotReport(ruleName, code)).resolves.toBeUndefined();
  });
});

describe("with ESLint's options", () => {
  it("checks switch cases against each other", async () => {
    await expect(
      fix("switch (x) {\n  case 1:\n    break;\n  case 2:\n    break;\n}\n", [
        { blankLine: "always", prev: "*", next: "case" },
      ]),
    ).resolves.toBe("switch (x) {\n  case 1:\n    break;\n\n  case 2:\n    break;\n}\n");
  });

  it("moves a statement sharing the line one blank line below, at the line's indentation", async () => {
    await expect(fix("  a(); b();\n", always)).resolves.toBe("  a();\n\n  b();\n");
  });

  it("reports a blank line under never with the removal message", async () => {
    await expect(reportedMessages(ruleName, "a();\n\nb();\n", { ruleOptionList: never })).resolves.toEqual([
      unexpected,
    ]);
  });

  it("removes every blank line outside comments and keeps the indentation", async () => {
    await expect(fix("a();\n\n\n  // lead\n\n  b();\n", never)).resolves.toBe("a();\n  // lead\n  b();\n");
  });

  it("removes a CRLF blank line", async () => {
    await expect(fix("a();\r\n\r\nb();\r\n", never)).resolves.toBe("a();\r\nb();\r\n");
  });

  it("lets the last matching option win", async () => {
    await expect(
      fix("const a = 1;\nconst b = 2;\n", [
        { blankLine: "any", prev: "const", next: "const" },
        { blankLine: "always", prev: "*", next: "*" },
      ]),
    ).resolves.toBe("const a = 1;\n\nconst b = 2;\n");
    await expect(
      assertRuleDoesNotReport(ruleName, "const a = 1;\nconst b = 2;\n", {
        ruleOptionList: [
          { blankLine: "always", prev: "*", next: "*" },
          { blankLine: "any", prev: "const", next: "const" },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it("checks only the pairs an option matches", async () => {
    const onlyReturns = { ruleOptionList: [{ blankLine: "always", prev: "*", next: "return" }] };
    await expect(
      assertRuleReports(ruleName, "function f() {\n  a();\n  return;\n}\n", onlyReturns),
    ).resolves.toBeUndefined();
    await expect(
      assertRuleDoesNotReport(ruleName, "function f() {\n  a();\n  throw e;\n}\n", onlyReturns),
    ).resolves.toBeUndefined();
  });

  it("leaves statements alone when no option matches", async () => {
    await expect(
      assertRuleDoesNotReport(ruleName, "a();\nb();\n", {
        ruleOptionList: [{ blankLine: "always", prev: "*", next: "return" }],
      }),
    ).resolves.toBeUndefined();
  });

  it("ignores a blank line inside a comment under never", async () => {
    await expect(
      assertRuleDoesNotReport(ruleName, "a();\n/* one\n\n two */\nb();\n", { ruleOptionList: never }),
    ).resolves.toBeUndefined();
  });

  it("rejects an unknown statement type", async () => {
    const result = await lintCode(ruleName, "a();\nb();\n", {
      ruleOptionList: [{ blankLine: "always", prev: "*", next: "statement" }],
    });
    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(
      /Options validation failed for rule 'core\/padding-line-between-statements'/,
    );
    expect(result.source).toBe("a();\nb();\n");
  });
});
