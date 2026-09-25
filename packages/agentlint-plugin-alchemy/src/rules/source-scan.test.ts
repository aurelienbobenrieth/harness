import { expect, it } from "vitest";
import { resourceDeclarations, stackDeclarations, statefulResources } from "./alchemy-declarations.js";
import { constInitializer, findCalls, normalizeExpression, objectEntries, stringValue } from "./source-scan.js";

it("skips comments, strings and unbalanced calls", () => {
  const source = [
    '/* R2.Bucket("InBlock") */',
    "const note = 'it\\'s R2.Bucket(\"InString\")';",
    "const apostrophe = 'unterminated",
    'R2.Bucket("Real", { name: `a-${stage}` }).pipe(retain())',
    'R2.Bucket("Open", {',
  ].join("\n");
  expect(findCalls(source, String.raw`R2\.Bucket`).map((call) => [call.line, call.args, call.pipes])).toEqual([
    [4, ['"Real"', "{ name: `a-${stage}` }"], ["retain()"]],
  ]);
  expect(findCalls("x.pipe(", "x")).toEqual([]);
  expect(findCalls('R2.Bucket("A").pipe(retain(', String.raw`R2\.Bucket`)[0]?.pipes).toEqual([]);
  expect(findCalls('// R2.Bucket("A")', String.raw`R2\.Bucket`)).toEqual([]);
  expect(findCalls('/* open R2.Bucket("A")', String.raw`R2\.Bucket`)).toEqual([]);
});

it("reads literals, objects and normalized expressions", () => {
  expect([
    stringValue('"a"'),
    stringValue("'b'"),
    stringValue("`c`"),
    stringValue("`${d}`"),
    stringValue('"a" + "b"'),
  ]).toEqual(["a", "b", "c", undefined, undefined]);
  expect(objectEntries("props")).toBeUndefined();
  expect(objectEntries("{ a } + b")).toBeUndefined();
  expect([...(objectEntries('{ "quoted": 1, short, ...rest, nested: { x: a ? b : c }, }') ?? [])]).toEqual([
    ["quoted", "1"],
    ["short", "short"],
    ["...rest", "...rest"],
    ["nested", "{ x: a ? b : c }"],
  ]);
  expect(normalizeExpression("f( { a: 'x', } )")).toEqual(normalizeExpression('f({a: "x"})'));
});

it("reads resource declarations with computed IDs, opaque props and renamedFrom claims", () => {
  const source = [
    "Cloudflare.R2.Bucket();",
    "Cloudflare.R2.Bucket(`${prefix}-assets`, props);",
    'Cloudflare.D1 . Database("Db").pipe(Alchemy.renamedFrom("Old", { fqn: "Site/Older" }, dynamicId), RemovalPolicy.retain(true));',
  ].join("\n");
  expect(
    resourceDeclarations("a.ts", source, statefulResources).map((declaration) => [
      declaration.type,
      declaration.id,
      declaration.props === undefined,
      declaration.renamedFrom,
      declaration.retained,
    ]),
  ).toEqual([
    ["R2.Bucket", "`${prefix}-assets`", true, [], false],
    ["D1.Database", "Db", false, ["Old", "Site/Older"], true],
  ]);
  expect(resourceDeclarations("a.ts", source, [])).toEqual([]);
});

it("reads stack names and state options, skipping computed names", () => {
  expect(
    stackDeclarations(
      "a.ts",
      'Alchemy.Stack(name, { state: s });\nAlchemy.Stack("A", options, eff);\nStack<App, Shape>()("B");\nyield* Stack;',
    ),
  ).toEqual([
    { path: "a.ts", name: "A", state: undefined, line: 2 },
    { path: "a.ts", name: "B", state: undefined, line: 3 },
  ]);
});

it("resolves the single const initializer of a name, across continued lines", () => {
  expect(
    constInitializer("const state =\n  Cloudflare.state({\n    workerName: 'a',\n  })\n  .pipe(x);\nlater();", "state"),
  ).toEqual("Cloudflare.state({\n    workerName: 'a',\n  })\n  .pipe(x)");
  expect(constInitializer("const state: Layer = localState()\nnext()", "state")).toEqual("localState()");
  expect(constInitializer("const state = a();\nconst state = b();", "state")).toBeUndefined();
  expect(constInitializer("let state = a();\nconst stateful = b();", "state")).toBeUndefined();
  expect(constInitializer("const $s = a();", "$s")).toEqual("a()");
});
