import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { definePropertyTestOpportunity, propertyTestOpportunity } from "./rule.js";

const pairMessage = (forward: string, backward: string): string =>
  `\`${forward}\` and \`${backward}\` are inverses tested by examples only; state the round-trip as one property over generated inputs, or show that the transform is lossy or its domain closed.`;
const idempotentMessage = (name: string): string =>
  `\`${name}\` is tested by examples only; state that applying it twice equals applying it once as a property over generated inputs, or show that its domain is closed.`;

async function messages(
  source: string,
  file = "src/cursor.test.ts",
  rule = propertyTestOpportunity,
): Promise<readonly string[]> {
  return (await testRuleOnSource(rule, source, file)).map((finding) => finding.message);
}

const cursorExamples = `
import { describe, expect, it } from "vitest";
import { encodeCursor, decodeCursor } from "./cursor";

describe("cursor", () => {
  it("round-trips the first page", () => {
    expect(decodeCursor(encodeCursor({ page: 1 }))).toEqual({ page: 1 });
  });
  it("round-trips a filter", () => {
    expect(decodeCursor(encodeCursor({ page: 2, q: "a b" }))).toEqual({ page: 2, q: "a b" });
  });
  it("rejects garbage", () => {
    expect(() => decodeCursor("???")).toThrow("Malformed cursor");
  });
});`;

const threeTests = (body: string): string =>
  ["a", "b", "c"].map((name) => `it("${name}", () => { ${body} });`).join("\n");

it("reports an inverse pair imported from one module and tested by examples", async () => {
  expect(await messages(cursorExamples)).toEqual([pairMessage("encodeCursor", "decodeCursor")]);
});

const file = (names: string): string => `import { ${names} } from "../codec.js";\nit("x", () => {});`;

it("recognises the other pair families", async () => {
  expect(await messages(file("parseDuration, formatDuration"))).toEqual([
    pairMessage("formatDuration", "parseDuration"),
  ]);
  expect(await messages(file("toRow, fromRow"))).toEqual([pairMessage("toRow", "fromRow")]);
  expect(await messages(file("serialize, deserialize"))).toEqual([pairMessage("serialize", "deserialize")]);
  expect(await messages(file("unescapeHtml as unescape, escapeHtml"))).toEqual([
    pairMessage("escapeHtml", "unescapeHtml"),
  ]);
});

it("reports an idempotent normaliser covered by three example tests", async () => {
  const source = `import { normalizePhone } from "./phone";\n${threeTests('expect(normalizePhone("06 12")).toBe("+33612");')}`;
  expect(await messages(source, "src/phone.spec.ts")).toEqual([idempotentMessage("normalizePhone")]);
});

it("stays silent once the file uses a property API", async () => {
  const withProperty = `${cursorExamples}
it("decodes what it encoded", () => {
  fc.assert(fc.property(cursorArbitrary, (cursor) => expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)));
});`;
  const withItProp = `import { normalizePhone } from "./phone";\n${threeTests("expect(1).toBe(1);")}\nit.prop([phone])("is idempotent", (p) => normalizePhone(normalizePhone(p)) === normalizePhone(p));`;
  expect(await messages(withProperty)).toEqual([]);
  expect(await messages(withItProp)).toEqual([]);
});

it("stays silent when the two halves come from different modules", async () => {
  const source = `import { parse } from "./a";\nimport { format } from "./b";\nit("x", () => { expect(parse(format(1))).toBe(1); });`;
  expect(await messages(source)).toEqual([]);
});

it("stays silent when the names do not share a subject", async () => {
  const source = `import { toJSON, fromRow, encodeId, decodeToken } from "./mapping";\nit("x", () => { expect(toJSON(fromRow(row))).toEqual({}); });`;
  expect(await messages(source)).toEqual([]);
});

it("stays silent on an idempotent candidate with fewer than three tests", async () => {
  const source = `import { sortBy } from "./sort";\nit("a", () => { expect(sortBy(xs, "id")).toEqual(ys); });\nit("b", () => { expect(sortBy([], "id")).toEqual([]); });`;
  expect(await messages(source)).toEqual([]);
});

it("counts a parameterised table as one test", async () => {
  const source = `import { sortBy } from "./sort";\nit.each([[1], [2]])("a %s", (n) => { expect(sortBy([n], "id")).toEqual([n]); });\nit("b", () => { expect(sortBy([], "id")).toEqual([]); });`;
  expect(await messages(source)).toEqual([]);
});

it("ignores package imports, type imports and non-test files", async () => {
  expect(await messages('import { encode, decode } from "base64-codec";\nit("x", () => {});')).toEqual([]);
  expect(await messages('import type { encode, decode } from "./codec";\nit("x", () => {});')).toEqual([]);
  expect(await messages('import { type encode, decode } from "./codec";\nit("x", () => {});')).toEqual([]);
  expect(await messages(cursorExamples, "src/cursor.ts")).toEqual([]);
});

it("accepts replacement patterns and mirrors them into the binding", async () => {
  const rule = definePropertyTestOpportunity({
    pairPatterns: [[/^inflate/, /^deflate/]],
    idempotentPattern: /^tidy/,
    propertyApiPattern: /\bforAll\(/g,
  });
  const inflate = 'import { inflateBody, deflateBody } from "./zip";\nit("x", () => {});';
  expect(await messages(inflate, "src/zip.test.ts", rule)).toEqual([pairMessage("inflateBody", "deflateBody")]);
  expect(await messages(inflate)).toEqual([]);
  expect(await messages(cursorExamples, "src/cursor.test.ts", rule)).toEqual([]);
  expect(await messages(`${inflate}\nforAll(bodies, check);`, "src/zip.test.ts", rule)).toEqual([]);
  expect(await messages(`${inflate}\nforAll(bodies, check);`, "src/zip.test.ts", rule)).toEqual([]);

  expect(rule.binding.options).toEqual({
    pairPatterns: [
      [
        { source: "^inflate", flags: "" },
        { source: "^deflate", flags: "" },
      ],
    ],
    idempotentPattern: { source: "^tidy", flags: "" },
    propertyApiPattern: { source: "\\bforAll\\(", flags: "g" },
  });
  expect(propertyTestOpportunity.binding.options).toEqual({
    pairPatterns: null,
    idempotentPattern: null,
    propertyApiPattern: null,
  });
  expect(propertyTestOpportunity.binding.exclude).toEqual(["**/*.d.ts"]);
});
