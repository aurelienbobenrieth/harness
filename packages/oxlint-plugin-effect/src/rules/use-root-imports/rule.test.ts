import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/use-root-imports";

it("reports stable Effect subpath imports", async () => {
  await expect(assertRuleReports(ruleName, 'import { Effect } from "effect/Effect";\n')).resolves.toBeUndefined();
});

it("reports stable Schema subpath imports", async () => {
  await expect(assertRuleReports(ruleName, 'import { Schema } from "effect/Schema";\n')).resolves.toBeUndefined();
});

it("allows root Effect imports", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { Effect, Schema } from "effect";\n'),
  ).resolves.toBeUndefined();
});

it("allows unstable Effect subpath imports", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { Workflow } from "effect/unstable/workflow/Workflow";\n'),
  ).resolves.toBeUndefined();
});

it("ignores unrelated imports", async () => {
  await expect(assertRuleDoesNotReport(ruleName, 'import { z } from "zod";\n')).resolves.toBeUndefined();
});
