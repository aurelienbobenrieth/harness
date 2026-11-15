import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-multi-positional-parameters";

it("reports function declarations with multiple parameters", async () => {
  await expect(
    assertRuleReports(ruleName, "function loadUser(userId: UserId, includePosts: boolean) { return userId; }\n"),
  ).resolves.toBeUndefined();
});

it("reports arrow function constants with multiple parameters", async () => {
  await expect(
    assertRuleReports(ruleName, "const loadUser = (userId: UserId, includePosts: boolean) => userId;\n"),
  ).resolves.toBeUndefined();
});

it("allows callbacks whose positional contract belongs to the caller", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const names = users.map((user, index) => `${index}:${user.name}`);\n"),
  ).resolves.toBeUndefined();
});

it("allows constructor callbacks whose positional contract belongs to the constructor", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const deferred = new Promise((resolve, reject) => resolve(reject));\n"),
  ).resolves.toBeUndefined();
});

it("reports function expressions with multiple parameters", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const loadUser = function (userId: UserId, includePosts: boolean) { return userId; };\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows functions with one object parameter", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "export function loadUser(input: { userId: UserId; includePosts: boolean }) { return input; }\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows callbacks with one object parameter", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const names = users.map(({ user, index }) => `${index}:${user.name}`);\n"),
  ).resolves.toBeUndefined();
});

it("allows exported zero parameter functions", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export function loadUser() { return undefined; }\n"),
  ).resolves.toBeUndefined();
});

it("allows function declarations listed in exemptFunctionNames", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function merge(left: Config, right: Config) { return left ?? right; }\n", {
      ruleOptions: { exemptFunctionNames: ["merge"] },
    }),
  ).resolves.toBeUndefined();
});

it("allows arrow constants listed in exemptFunctionNames", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const merge = (left: Config, right: Config) => left ?? right;\n", {
      ruleOptions: { exemptFunctionNames: ["merge"] },
    }),
  ).resolves.toBeUndefined();
});

it("reports functions not listed in exemptFunctionNames", async () => {
  await expect(
    assertRuleReports(ruleName, "function split(value: string, separator: string) { return value; }\n", {
      ruleOptions: { exemptFunctionNames: ["merge"] },
    }),
  ).resolves.toBeUndefined();
});

it("allows files listed in exemptFileBasenames", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function loadUser(userId: UserId, includePosts: boolean) { return userId; }\n", {
      filename: "legacy.ts",
      ruleOptions: { exemptFileBasenames: ["legacy.ts"] },
    }),
  ).resolves.toBeUndefined();
});

it("reports files not listed in exemptFileBasenames", async () => {
  await expect(
    assertRuleReports(ruleName, "function loadUser(userId: UserId, includePosts: boolean) { return userId; }\n", {
      filename: "current.ts",
      ruleOptions: { exemptFileBasenames: ["legacy.ts"] },
    }),
  ).resolves.toBeUndefined();
});

type Case = readonly [label: string, source: string];

const exempt: readonly Case[] = [
  [
    "a callback to a method of an unresolved value",
    "export const run = items.reduce((total, item) => total + item, 0);\n",
  ],
  ["a callback to a builtin", "setTimeout((a, b) => a + b, 0);\naddEventListener('x', (event, extra) => extra);\n"],
  ["a callback to a bare-specifier import", "import { on } from 'emitter';\non('ready', (payload, meta) => meta);\n"],
  [
    "a callback to a namespace import of a package",
    "import * as ee from 'emitter';\nee.on('ready', (payload, meta) => meta);\n",
  ],
  [
    "XState guards in an object handed to an xstate import",
    "import { setup } from 'xstate';\nexport const machine = setup({ guards: { isOwner: (context, event) => context.owner === event.owner } });\n",
  ],
  [
    "a config object handed to a package helper",
    "import { defineConfig } from 'tool';\nexport default defineConfig({ transform: (code, id) => code + id });\n",
  ],
  [
    "a Worker default export, which the platform calls",
    "export default { fetch(request, env, ctx) { return env; } };\n",
  ],
  [
    "a binding annotated with a bare-specifier type",
    "import type { Comparator } from 'sorting';\nexport const byId: Comparator<Row> = (left, right) => left.id - right.id;\n",
  ],
  ["a binding annotated with a lib global type", "export const onTick: EventListener = (event, extra) => extra;\n"],
  [
    "a satisfies check against a global type",
    "export const worker = { fetch(request, env, ctx) { return env; } } satisfies ExportedHandler<Env>;\n",
  ],
  [
    "an as-cast to a bare-specifier type",
    "import type { Handler } from 'framework';\nexport const handler = ((req, res) => res) as Handler;\n",
  ],
  [
    "an override of a class from a bare specifier",
    "import { Base } from 'framework';\nclass Child extends Base { override run(left: string, right: number) { return left + right; } }\n",
  ],
  [
    "an override of a global class",
    "class Child extends HTMLElement { override attributeChangedCallback(name: string, oldValue: string, value: string) {} }\n",
  ],
];

it.each(exempt)("allows %s", async (_label, source) => {
  await expect(assertRuleDoesNotReport(ruleName, source)).resolves.toBeUndefined();
});

const flagged: readonly Case[] = [
  [
    "an unannotated object member nothing types",
    "export const guards = { isOwner: (context, event) => context.owner === event.owner };\n",
  ],
  [
    "a callback to a function declared in the same file",
    "function each(items, visit) { return items.map(visit); }\neach([], (item, index) => index);\n",
  ],
  [
    "a callback to a const arrow declared in the same file",
    "const each = (items) => items;\neach([], (item, index) => index);\n",
  ],
  ["a callback to a relative import", "import { each } from './each.ts';\neach([], (item, index) => index);\n"],
  [
    "a callback to a method of a local object",
    "const bus = { on(name, handler) {} };\nbus.on('x', (payload, meta) => meta);\n",
  ],
  [
    "an object handed to a local function",
    "function configure(options) { return options; }\nconfigure({ transform: (code, id) => code + id });\n",
  ],
  [
    "a binding annotated with a locally declared type",
    "type Compare = (a: Row, b: Row) => number;\nexport const byId: Compare = (left, right) => left.id - right.id;\n",
  ],
  [
    "a binding annotated with a type from a relative import",
    "import type { Compare } from './types.ts';\nexport const byId: Compare = (left, right) => left.id - right.id;\n",
  ],
  [
    "a binding annotated with an inline function type",
    "export const byId: (a: Row, b: Row) => number = (left, right) => left.id - right.id;\n",
  ],
  [
    "a satisfies check against a locally declared type",
    "interface Local { run(a: string, b: number): void }\nexport const x = { run(a, b) {} } satisfies Local;\n",
  ],
  [
    "an override of a class declared in the same file",
    "class Base {}\nclass Child extends Base { override run(left: string, right: number) { return left + right; } }\n",
  ],
  [
    "an override of a class from a relative import",
    "import { Base } from './base.ts';\nclass Child extends Base { override run(left: string, right: number) { return left + right; } }\n",
  ],
  [
    "the implementation of overload signatures",
    "export function pick(a: string): string;\nexport function pick(a: string, b: number): number;\nexport function pick(a: string, b?: number) { return b ?? a; }\n",
  ],
  [
    "annotated functions that nothing types",
    "export const byId = (left: Row, right: Row) => left.id - right.id;\nexport const table = { sort: (left: Row, right: Row) => left.id - right.id };\n",
  ],
];

it.each(flagged)("reports %s", async (_label, source) => {
  await expect(assertRuleReports(ruleName, source)).resolves.toBeUndefined();
});

it("reports unannotated functions in JavaScript", async () => {
  await expect(
    assertRuleReports(ruleName, "export const total = (price, tax) => price + tax;\n", { filename: "total.js" }),
  ).resolves.toBeUndefined();
});
