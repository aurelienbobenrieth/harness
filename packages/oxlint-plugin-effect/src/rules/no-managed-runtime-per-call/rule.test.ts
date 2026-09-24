import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-managed-runtime-per-call";

it("reports ManagedRuntime.make inside a request handler", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { ManagedRuntime } from "effect";\nexport async function handler(request: Request) { const runtime = ManagedRuntime.make(AppLive); return runtime.runPromise(handle(request)); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports ManagedRuntime.make inside an arrow factory with a namespace import", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import * as ManagedRuntime from "effect/ManagedRuntime";\nexport const makeRuntime = () => ManagedRuntime.make(AppLive);\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows ManagedRuntime.make at module scope", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { ManagedRuntime } from "effect";\nexport const runtime = ManagedRuntime.make(AppLive, { memoMap });\nexport const handler = (request: Request) => runtime.runPromise(handle(request));\n',
    ),
  ).resolves.toBeUndefined();
});

it("allows runtimes built in test hooks by default", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { ManagedRuntime } from "effect";\nbeforeAll(() => { runtime = ManagedRuntime.make(TestLive); });\n',
      { filename: "repo.test.ts" },
    ),
  ).resolves.toBeUndefined();
});

it("reports in test files once the allow list is emptied", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { ManagedRuntime } from "effect";\nbeforeAll(() => { runtime = ManagedRuntime.make(TestLive); });\n',
      { filename: "repo.test.ts", ruleConfig: ["error", { allow: [] }] },
    ),
  ).resolves.toBeUndefined();
});

it("ignores make on other modules and local shadows", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const build = () => Layer.make(AppLive);",
        "function local() { const ManagedRuntime = { make: (layer: unknown) => layer }; return ManagedRuntime.make(AppLive); }",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});
