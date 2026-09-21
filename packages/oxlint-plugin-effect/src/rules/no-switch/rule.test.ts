import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-switch";
const effectImport = 'import { Match } from "effect";\n';

it("reports switch statements in Effect files", async () => {
  await expect(
    assertRuleReports(ruleName, `${effectImport}switch (kind) {\n  case "a":\n    break;\n}\n`),
  ).resolves.toBeUndefined();
});

it("reports switch statements in files importing scoped effect packages", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { NodeRuntime } from "@effect/platform-node";\nswitch (kind) {\n  default:\n    break;\n}\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows switch statements in files without an effect import", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'switch (kind) {\n  case "a":\n    break;\n}\n'),
  ).resolves.toBeUndefined();
});
