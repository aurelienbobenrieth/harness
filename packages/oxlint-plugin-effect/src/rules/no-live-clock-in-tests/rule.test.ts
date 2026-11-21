import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-live-clock-in-tests";
const testFile = { filename: "expiry.test.ts" };

it("reports the live clock read through the Clock reference default", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { Clock } from "effect";\nconst now = Clock.Clock.defaultValue().currentTimeMillisUnsafe();\n',
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it("reports DateTime.nowUnsafe through a namespace import", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import * as DateTime from "effect/DateTime";\nconst at = DateTime.nowUnsafe();\n',
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it("allows time read through the provided Clock", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import { Clock, DateTime } from "effect";',
        'import { TestClock } from "effect/testing";',
        "const read = Clock.currentTimeMillis;",
        "const at = DateTime.now;",
        'const fixed = DateTime.makeUnsafe("2026-01-01T00:00:00Z");',
        "const later = TestClock.adjust(1000);",
      ].join("\n"),
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it("ignores a local DateTime that is not Effect's", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const DateTime = { nowUnsafe: () => 0 };\nconst at = DateTime.nowUnsafe();\n",
      testFile,
    ),
  ).resolves.toBeUndefined();
});

it("ignores production files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { DateTime } from "effect";\nconst at = DateTime.nowUnsafe();\n', {
      filename: "expiry.ts",
    }),
  ).resolves.toBeUndefined();
});

it("checks an in-memory host outside test files once allFiles is set", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { DateTime } from "effect";\nconst at = DateTime.nowUnsafe();\n', {
      filename: "hosting/in-memory.ts",
      ruleOptions: { allFiles: true },
    }),
  ).resolves.toBeUndefined();
});
