import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "cloudflare/workflow-deterministic-steps";
const header = 'import { WorkflowEntrypoint } from "cloudflare:workers";\n';

it("reports a step name built from Date.now()", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export class Sync extends WorkflowEntrypoint {\n  async run(event: unknown, step: any) {\n    await step.do(\`sync at \${Date.now()}\`, async () => 1);\n  }\n}\n`,
      { message: /step name changes on every run/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports random values in sleep and waitForEvent names", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export class Sync extends WorkflowEntrypoint {\n  async run(event: unknown, s: any) {\n    await s.sleep("pause " + crypto.randomUUID(), "1 minute");\n    await s.waitForEvent(\`approval \${Math.random()}\`, { type: "approved" });\n  }\n}\n`,
      { message: /step name changes on every run/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports nondeterminism in run() outside a step.do callback", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export class Sync extends WorkflowEntrypoint {\n  async run(event: { payload: { ids: string[] } }, step: any) {\n    const startedAt = new Date();\n    const picks = event.payload.ids.filter(() => Math.random() > 0.5);\n    await step.do("store", async () => ({ startedAt, picks }));\n  }\n}\n`,
      { message: /differs on every replay/ },
    ),
  ).resolves.toBeUndefined();
});

it("accepts nondeterminism inside step.do callbacks, with or without a config argument", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export class Sync extends WorkflowEntrypoint {\n  async run(event: unknown, step: any) {\n    const id = await step.do("make id", async () => crypto.randomUUID());\n    const at = await step.do("stamp", { retries: { limit: 2, delay: "1 second" } }, async () => [Date.now(), new Date().toISOString()]);\n    await step.do(\`notify \${id}\`, async () => at);\n    await step.sleep("cool down", "10 seconds");\n  }\n}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts new Date(value) and Date.now() outside Workflow run()", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export class Sync extends WorkflowEntrypoint {\n  async run(event: { timestamp: Date }, step: any) {\n    const at = new Date(event.timestamp);\n    await step.do("log", async () => at.toISOString());\n  }\n  helper() { return Date.now(); }\n}\nexport class Plain {\n  async run(event: unknown, step: any) { await step.do(\`x \${Date.now()}\`, async () => 1); }\n}\n`,
    ),
  ).resolves.toBeUndefined();
});
