import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "effect/no-native-failure";
const imports = 'import { Effect } from "effect";\n';

describe("reports", () => {
  it.each([
    ["throw in a plain function", "export function parse(x: string) { if (!x) throw new Error('empty'); return x; }\n"],
    ["throw in an arrow function", "export const parse = (x: string) => { throw new Error(x); };\n"],
    ["throw at module level", "throw new Error('boot');\n"],
    ["throw in a class method", "class Parser { parse() { throw new Error('x'); } }\n"],
    ["throw in an Effect.sync thunk", "export const a = Effect.sync(() => { throw new Error('x'); });\n"],
    ["throw in an Effect.promise thunk", "export const a = Effect.promise(async () => { throw new Error('x'); });\n"],
    [
      "throw in the catch mapper of Effect.try",
      "export const a = Effect.try({ try: () => 1, catch: (e) => { throw e; } });\n",
    ],
    [
      "try/catch in a plain function",
      "export function read() { try { return JSON.parse('{}'); } catch { return undefined; } }\n",
    ],
    [
      "try/catch/finally",
      "export function read() { try { return 1; } catch (e) { return 2; } finally { cleanup(); } }\n",
    ],
    [
      "try/catch in an async function",
      "export async function load() { try { return await fetch('/'); } catch { return null; } }\n",
    ],
    [
      "try/catch in an Effect.sync thunk",
      "export const a = Effect.sync(() => { try { return 1; } catch { return 2; } });\n",
    ],
    [
      "throw in a function nested in an Effect.gen",
      "export const a = Effect.gen(function* () { const f = () => { throw new Error('x'); }; return f; });\n",
    ],
  ])("%s", async (_label, code) => {
    await assertRuleReports(ruleName, imports + code);
  });

  it("states the violation and the fix for throw and try", async () => {
    const messages = await reportedMessages(
      ruleName,
      imports + "export function a() { throw new Error('x'); }\nexport function b() { try { a(); } catch {} }\n",
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("Effect.fail");
    expect(messages[1]).toContain("Effect.try");
  });

  it("reports throw of a call that is not a framework import", async () => {
    await assertRuleReports(
      ruleName,
      imports + "import { redirect } from './redirect.js';\nexport const a = () => { throw redirect('/'); };\n",
    );
  });

  it("reports in a file importing a subpath or an @effect package", async () => {
    await assertRuleReports(
      ruleName,
      'import { gen } from "effect/Effect";\nexport function a() { throw new Error("x"); }\n',
    );
    await assertRuleReports(
      ruleName,
      'import { it } from "@effect/vitest";\nexport function a() { throw new Error("x"); }\n',
    );
  });

  it("reports in a test-support file once allow replaces the default", async () => {
    await assertRuleReports(ruleName, imports + "export function a() { throw new Error('x'); }\n", {
      filename: "src/a.test.ts",
      ruleOptions: { allow: [] },
    });
  });
});

describe("stays silent", () => {
  it.each([
    [
      "throw in the try callback of Effect.try",
      "export const a = Effect.try({ try: () => { throw new Error('x'); }, catch: (e) => e });\n",
    ],
    ["throw in an Effect.try thunk", "export const a = Effect.try(() => { throw new Error('x'); });\n"],
    [
      "throw in an Effect.tryPromise callback",
      "export const a = Effect.tryPromise({ try: async () => { throw new Error('x'); }, catch: (e) => e });\n",
    ],
    [
      "try/catch inside an Effect.tryPromise callback",
      "export const a = Effect.tryPromise({ try: async () => { try { return await fetch('/'); } catch { return null; } }, catch: (e) => e });\n",
    ],
    [
      "a helper nested in an Effect.try callback",
      "export const a = Effect.try({ try: () => { const f = () => { throw new Error('x'); }; return f(); }, catch: (e) => e });\n",
    ],
    ["try/finally without catch", "export function a() { try { return 1; } finally { cleanup(); } }\n"],
    [
      "throw directly in Effect.gen (no-unsafe-effect-body owns it)",
      "export const a = Effect.gen(function* () { throw new Error('x'); });\n",
    ],
    [
      "throw directly in Effect.fn (no-unsafe-effect-body owns it)",
      "export const a = Effect.fn('a')(function* () { throw new Error('x'); });\n",
    ],
    [
      "try/catch directly in Effect.gen (tsgo owns it)",
      "export const a = Effect.gen(function* () { try { return 1; } catch { return 2; } });\n",
    ],
    [
      "throw redirect() from a router framework",
      "import { redirect } from '@tanstack/react-router';\nexport const a = () => { throw redirect({ to: '/' }); };\n",
    ],
    [
      "throw notFound() through a namespace import",
      "import * as nav from 'next/navigation';\nexport const a = () => { throw nav.notFound(); };\n",
    ],
    ["Effect.fail", "export const a = Effect.fail({ _tag: 'NotFoundError' as const });\n"],
  ])("%s", async (_label, code) => {
    await assertRuleDoesNotReport(ruleName, imports + code);
  });

  it("in a file that does not import Effect", async () => {
    await assertRuleDoesNotReport(
      ruleName,
      "export function a() { try { throw new Error('x'); } catch { return 1; } }\n",
    );
  });

  it("when Effect is only a local name", async () => {
    await assertRuleDoesNotReport(
      ruleName,
      'import { Effect } from "./effect.js";\nexport function a() { throw new Error("x"); }\n',
    );
  });

  it.each(["src/a.test.ts", "src/testing/helpers.ts", "src/fixtures/seed.ts", "scripts/seed.ts"])(
    "in test-support file %s",
    async (filename) => {
      await assertRuleDoesNotReport(ruleName, imports + "export function a() { throw new Error('x'); }\n", {
        filename,
      });
    },
  );
});
