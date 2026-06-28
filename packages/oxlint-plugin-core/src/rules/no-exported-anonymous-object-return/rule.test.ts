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
