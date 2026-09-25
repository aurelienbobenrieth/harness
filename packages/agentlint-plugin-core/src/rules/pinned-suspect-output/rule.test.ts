import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { definePinnedSuspectOutput, pinnedSuspectOutput } from "./rule.js";

const messageFor = (token: string): string =>
  `Expected text pins \`${token}\`, which usually records a missing or non-numeric input rather than intended output; repair the subject or the fixture and assert the intended text, or name the token in the test title when printing it is the contract.`;

async function messages(
  source: string,
  file = "src/greeting.test.ts",
  rule = pinnedSuspectOutput,
): Promise<readonly string[]> {
  return (await testRuleOnSource({ rule: rule, source: source, file: file })).map((finding) => finding.message);
}

const inTest = (assertion: string, title = "formats the label"): string =>
  `it(${JSON.stringify(title)}, async () => {\n  ${assertion}\n});`;

it("reports expected strings that print a missing value", async () => {
  expect(await messages(inTest('expect(greeting(user)).toBe("Hello undefined!");'))).toEqual([messageFor("undefined")]);
  expect(await messages(inTest('expect(render(cart)).toContain("[object Object]");'))).toEqual([
    messageFor("[object Object]"),
  ]);
  expect(await messages(inTest("expect(due(invoice)).toEqual(`Due: Invalid Date`);"))).toEqual([
    messageFor("Invalid Date"),
  ]);
  expect(await messages(inTest('await expect(label(item)).resolves.toBe("Size: null");'))).toEqual([
    messageFor("null"),
  ]);
});

it("reports inline snapshots of strings and of structures holding NaN", async () => {
  expect(await messages(inTest('expect(price(item)).toMatchInlineSnapshot(`"NaN EUR"`);'))).toEqual([
    messageFor("NaN"),
  ]);
  const structure = inTest('expect(summary(cart)).toMatchInlineSnapshot(`\n  {\n    "total": NaN,\n  }\n`);');
  expect(await messages(structure)).toEqual([messageFor("NaN")]);
  const nested = inTest('expect(view(cart)).toMatchInlineSnapshot(`\n  {\n    "label": "Hi undefined",\n  }\n`);');
  expect(await messages(nested)).toEqual([messageFor("undefined")]);
});

it("stays silent on ordinary expectations and matchers without text", async () => {
  expect(await messages(inTest('expect(greeting(user)).toBe("Hello Ada!");'))).toEqual([]);
  expect(await messages(inTest("expect(find(id)).toBeUndefined();"))).toEqual([]);
  expect(await messages(inTest("expect(find(id)).toBe(undefined);"))).toEqual([]);
  expect(await messages(inTest("expect(parse(raw)).toBe(NaN);"))).toEqual([]);
  expect(await messages(inTest("expect(greeting(user)).toBe(`Hello ${undefinedName}`);"))).toEqual([]);
});

it("stays silent when the test title names the token", async () => {
  const assertion = 'expect(inspect(bag)).toBe("a: undefined");';
  expect(await messages(inTest(assertion, "prints Undefined for missing keys"))).toEqual([]);
  expect(await messages(inTest(assertion, "prints holes"))).toEqual([messageFor("undefined")]);
});

it("treats null as suspect only when embedded in non-JSON text", async () => {
  expect(await messages(inTest("expect(encode(row)).toBe('{\"a\":null}');"))).toEqual([]);
  expect(await messages(inTest('expect(encode(none)).toBe("null");'))).toEqual([]);
  expect(await messages(inTest('expect(kind(field)).toBe("nullable");'))).toEqual([]);
  expect(await messages(inTest('expect(kind(field)).toBe("undefinedBehaviour");'))).toEqual([]);
});

it("reads structured snapshots as data, where undefined and null are ordinary field values", async () => {
  const structure = inTest(
    'expect(row(user)).toMatchInlineSnapshot(`\n  {\n    "deletedAt": null,\n    "nickname": undefined,\n  }\n`);',
  );
  expect(await messages(structure)).toEqual([]);
});

it("ignores strings outside matcher arguments and non-test files", async () => {
  expect(await messages(inTest('const label = "undefined"; log("NaN"); expect(label).toBeDefined();'))).toEqual([]);
  expect(await messages(inTest('expect(greeting(user)).toBe("Hello undefined!");'), "src/greeting.ts")).toEqual([]);
});

it("caps findings at three per file", async () => {
  const source = [1, 2, 3, 4, 5].map((n) => inTest(`expect(label(${n})).toBe("Item ${n}: NaN");`, `case ${n}`));
  expect(await messages(source.join("\n"))).toHaveLength(3);
  expect(await messages(source.join("\n"))).toHaveLength(3);
});

it("accepts a custom pattern and mirrors it into the binding", async () => {
  const rule = definePinnedSuspectOutput({ suspectPattern: /\bTODO\b/g });
  const source = inTest('expect(title(page)).toBe("TODO title");');
  expect(await messages(source, "src/page.test.ts", rule)).toEqual([messageFor("TODO")]);
  expect(await messages(source, "src/page.test.ts", rule)).toEqual([messageFor("TODO")]);
  expect(await messages(source)).toEqual([]);
  expect(rule.binding.options).toEqual({ suspectPattern: { source: "\\bTODO\\b", flags: "g" } });
  expect(pinnedSuspectOutput.binding.options).toEqual({ suspectPattern: null });
  expect(pinnedSuspectOutput.binding.exclude).toEqual(["**/*.d.ts"]);
});
