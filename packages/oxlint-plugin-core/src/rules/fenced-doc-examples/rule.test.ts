import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

it("reports an executable JSDoc example without a fence", async () => {
  await assertRuleReports("core/fenced-doc-examples", "/** @example yield* runTask() */\nexport const task = 1;");
});

it("accepts a fenced example and ignores prose outside examples", async () => {
  await assertRuleDoesNotReport(
    "core/fenced-doc-examples",
    "/**\n * @example\n * ```ts\n * yield* runTask()\n * ```\n */\nexport const task = 1;",
  );
  await assertRuleDoesNotReport("core/fenced-doc-examples", "/** Run a task. */\nexport const task = 1;");
  await assertRuleReports(
    "core/fenced-doc-examples",
    "/** @example ```ts\n * run()\n * ```\n * @example runOther()\n */ export const task = 1;",
  );
});
