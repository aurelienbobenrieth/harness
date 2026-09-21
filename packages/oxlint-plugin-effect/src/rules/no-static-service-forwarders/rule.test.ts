import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-static-service-forwarders";

it("reports a static arrow forwarder calling a parameter method", async () => {
  await expect(
    assertRuleReports(ruleName, "class Users {\n  static list = (repo: UserRepo.Service) => repo.list();\n}\n"),
  ).resolves.toBeUndefined();
});

it("reports a static forwarder that returns the parameter call from a block", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "class Users {\n  static find = (repo: UserRepo.Service, id: string) => {\n    return repo.find(id);\n  };\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports a static forwarder with one call wrapping the parameter call", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "class Users {\n  static list = (repo: UserRepo.Service) => Effect.orDie(repo.list());\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports a static function-expression forwarder", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "class Users {\n  static list = function (repo: UserRepo.Service) {\n    return repo.list();\n  };\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows static properties with real logic", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "class Users {\n  static list = (repo: UserRepo.Service) => {\n    const rows = repo.list();\n    return rows.filter(isActive);\n  };\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows static forwarders composing multiple calls", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "class Users {\n  static list = (repo: UserRepo.Service) => pipe(repo.list(), Effect.map(toDto));\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows instance properties calling parameter methods", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "class Users {\n  list = (repo: UserRepo.Service) => repo.list();\n}\n"),
  ).resolves.toBeUndefined();
});

it("allows static values that are not functions", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "class Users {\n  static empty = [];\n}\n")).resolves.toBeUndefined();
});
