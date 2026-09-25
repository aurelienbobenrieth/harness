import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, fixCode } from "../test-support.ts";

const ruleName = "core/padding-before-exit";

describe("reports and pads", () => {
  it("reports a return right below another statement with the rule's message", async () => {
    await expect(
      assertRuleReports(ruleName, "function total(items) {\n  const sum = items.reduce(add, 0);\n  return sum;\n}\n", {
        message: /Separate this return\/throw from the statements above it with a blank line\./,
      }),
    ).resolves.toBeUndefined();
  });

  it("pads a return in a function block", async () => {
    await expect(
      fixCode(ruleName, "function total(items) {\n  const sum = items.reduce(add, 0);\n  return sum;\n}\n"),
    ).resolves.toBe("function total(items) {\n  const sum = items.reduce(add, 0);\n\n  return sum;\n}\n");
  });

  it("pads a return in a switch case and leaves a lone case return alone", async () => {
    await expect(
      fixCode(
        ruleName,
        'function size(kind) {\n  switch (kind) {\n    case "a":\n      log(kind);\n      return 1;\n    case "b":\n      return 2;\n  }\n}\n',
      ),
    ).resolves.toBe(
      'function size(kind) {\n  switch (kind) {\n    case "a":\n      log(kind);\n\n      return 1;\n    case "b":\n      return 2;\n  }\n}\n',
    );
  });

  it("pads a throw in a nested function and the return of the outer one", async () => {
    await expect(
      fixCode(
        ruleName,
        'const run = () => {\n  const check = (value) => {\n    if (!value) throw new Error("empty");\n    validate(value);\n    throw new Error("invalid");\n  };\n  check(1);\n  return check;\n};\n',
      ),
    ).resolves.toBe(
      'const run = () => {\n  const check = (value) => {\n    if (!value) throw new Error("empty");\n    validate(value);\n\n    throw new Error("invalid");\n  };\n  check(1);\n\n  return check;\n};\n',
    );
  });

  it("puts the blank line above the comment block that leads the return", async () => {
    await expect(
      fixCode(ruleName, "function f() {\n  work();\n  // Nothing left to do.\n  /* really */\n  return done;\n}\n"),
    ).resolves.toBe("function f() {\n  work();\n\n  // Nothing left to do.\n  /* really */\n  return done;\n}\n");
  });

  it("keeps a trailing comment on the statement it trails", async () => {
    await expect(fixCode(ruleName, "function f() {\n  work(); // note\n  return done;\n}\n")).resolves.toBe(
      "function f() {\n  work(); // note\n\n  return done;\n}\n",
    );
  });

  it("pads with CRLF in a CRLF file", async () => {
    await expect(fixCode(ruleName, "function f() {\r\n  work();\r\n  return done;\r\n}\r\n")).resolves.toBe(
      "function f() {\r\n  work();\r\n\r\n  return done;\r\n}\r\n",
    );
  });

  it("moves an exit that shares a line with the previous statement onto its own padded line", async () => {
    await expect(fixCode(ruleName, "function f() {\n  work(); return done;\n}\n")).resolves.toBe(
      "function f() {\n  work();\n\n  return done;\n}\n",
    );
  });

  it("pads a top-level throw", async () => {
    await expect(fixCode(ruleName, 'init();\nthrow new Error("stop");\n')).resolves.toBe(
      'init();\n\nthrow new Error("stop");\n',
    );
  });

  it("pads a throw in a class static block", async () => {
    await expect(
      fixCode(ruleName, 'class Config {\n  static {\n    load();\n    throw new Error("x");\n  }\n}\n'),
    ).resolves.toBe('class Config {\n  static {\n    load();\n\n    throw new Error("x");\n  }\n}\n');
  });

  it("leaves already padded code unchanged", async () => {
    const padded =
      'function f(kind) {\n  work(); // note\n\n  // Why we stop.\n  if (kind) return 1;\n  switch (kind) {\n    case "a":\n      log(kind);\n\n      throw new Error("a");\n  }\n\n  return 2;\n}\n';
    await expect(fixCode(ruleName, padded)).resolves.toBe(padded);
  });

  it("reaches a fixed point after one pass", async () => {
    const once = await fixCode(ruleName, "function f() {\n  work();\n  // done\n  return done;\n}\n");
    await expect(fixCode(ruleName, once)).resolves.toBe(once);
  });
});

describe("stays silent", () => {
  it.each([
    ["the first statement of a block", "function f() {\n  return done;\n}\n"],
    ["an exit as an if consequent", "function f(x) {\n  if (x) return;\n  work();\n}\n"],
    ["a single-statement arrow body", "const f = () => {\n  throw new Error('x');\n};\n"],
    ["a concise arrow body", "const f = (x) => x + 1;\n"],
    ["the first statement of a case", "function f(k) {\n  switch (k) {\n    case 1:\n      return 1;\n  }\n}\n"],
    ["a padded return", "function f() {\n  work();\n\n  return done;\n}\n"],
    ["a padded return below a comment block", "function f() {\n  work();\n\n  // done\n  return done;\n}\n"],
    ["a blank line between the comment and the return", "function f() {\n  work();\n  // done\n\n  return done;\n}\n"],
    ["a padded CRLF return", "function f() {\r\n  work();\r\n\r\n  return done;\r\n}\r\n"],
    ["statements that are not exits", "function f() {\n  work();\n  more();\n}\n"],
  ])("%s", async (_name, code) => {
    await expect(assertRuleDoesNotReport(ruleName, code)).resolves.toBeUndefined();
  });

  it("does not count a blank line inside a block comment as padding", async () => {
    await expect(
      assertRuleReports(ruleName, "function f() {\n  work();\n  /* first\n\n     second */\n  return done;\n}\n"),
    ).resolves.toBeUndefined();
  });
});
