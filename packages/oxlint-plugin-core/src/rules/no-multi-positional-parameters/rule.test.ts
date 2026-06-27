import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "core/no-multi-positional-parameters";

it("reports exported function declarations with multiple parameters", async () => {
  await expect(
    assertRuleReports(ruleName, "export function loadUser(userId: UserId, includePosts: boolean) { return userId; }\n"),
  ).resolves.toBeUndefined();
});

it("reports exported arrow function constants with multiple parameters", async () => {
  await expect(
    assertRuleReports(ruleName, "export const loadUser = (userId: UserId, includePosts: boolean) => userId;\n"),
  ).resolves.toBeUndefined();
});

it("allows exported functions with one object parameter", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "export function loadUser(input: { userId: UserId; includePosts: boolean }) { return input; }\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows local callbacks with multiple parameters", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const names = users.map((user, index) => `${index}:${user.name}`);\n"),
  ).resolves.toBeUndefined();
});

it("allows exported zero parameter functions", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "export function loadUser() { return undefined; }\n"),
  ).resolves.toBeUndefined();
});
