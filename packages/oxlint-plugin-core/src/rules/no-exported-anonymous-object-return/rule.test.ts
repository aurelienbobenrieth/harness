import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-exported-anonymous-object-return";

it("reports exported function declarations returning object literals without return types", async () => {
  await expect(
    assertRuleReports(ruleName, "export function getUser() { return { id: user.id }; }\n"),
  ).resolves.toBeUndefined();
});

it("reports exported function declarations with inline object return types", async () => {
  await expect(
    assertRuleReports(ruleName, "export function getUser(): { id: string } { return user; }\n"),
  ).resolves.toBeUndefined();
});

it("reports exported arrow functions returning object literals", async () => {
  await expect(
    assertRuleReports(ruleName, "export const getUser = () => ({ id: user.id });\n"),
  ).resolves.toBeUndefined();
});

it("reports exported arrow functions with inline object return types", async () => {
  await expect(
    assertRuleReports(ruleName, "export const getUser = (): { id: string } => user;\n"),
  ).resolves.toBeUndefined();
});

it("allows exported functions with named return types", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export function getUser(): UserView { return { id: user.id }; }\n"),
  ).resolves.toBeUndefined();
});

it("allows local functions returning object literals", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "function getUser() { return { id: user.id }; }\n"),
  ).resolves.toBeUndefined();
});

it("ignores examples in strings", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const example = `export function getUser() { return { id: user.id }; }`;\n"),
  ).resolves.toBeUndefined();
});

it("accepts regression: export function outer() { function inner() { return {}; } return 1; }", async () => {
  await assertRuleDoesNotReport(ruleName, "export function outer() { function inner() { return {}; } return 1; }");
});

it("reports regression: export default async function load<T>() { return { value: 1 }; }", async () => {
  await assertRuleReports(ruleName, "export default async function load<T>() { return { value: 1 }; }");
});

it.each([
  "function read() { return { id: 1 }; } export { read };",
  "export { read as load }; const read = () => ({ id: 1 });",
  "const read = () => ({ id: 1 }); export default read;",
  "const read = () => ({ id: 1 }); const alias = read; export { alias };",
  "function read(): { id: number }; function read() { return { id: 1 }; } export { read };",
  "export function read(): { id: number } | null { return null; }",
])("reports same-file public contracts through export forms: %s", async (source) => {
  await assertRuleReports(ruleName, source);
});

it.each([
  "type User = { id: number }; const read = (): User => ({ id: 1 }); export { read as load };",
  "function read(): number { const helper = () => ({ id: 1 }); return helper().id; } export default read;",
  "type User = { id: number }; function read(): User; function read() { return { id: 1 }; } export { read };",
  "const read = () => 1; function local() { const read = () => ({ id: 1 }); return read(); } export { read };",
  "export { read } from './service'; function read() { return { id: 1 }; }",
])("preserves named, nested, shadowed, or external contracts: %s", async (source) => {
  await assertRuleDoesNotReport(ruleName, source);
});
