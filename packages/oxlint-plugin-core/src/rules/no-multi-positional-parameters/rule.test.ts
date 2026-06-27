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

it("reports local callbacks with multiple parameters", async () => {
  await expect(
    assertRuleReports(ruleName, "const names = users.map((user, index) => `${index}:${user.name}`);\n"),
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
