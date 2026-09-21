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
