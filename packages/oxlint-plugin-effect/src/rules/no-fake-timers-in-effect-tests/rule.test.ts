import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-fake-timers-in-effect-tests";

it("reports vi.useFakeTimers in a file using @effect/vitest", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { it } from "@effect/vitest";\nimport { vi } from "vitest";\nvi.useFakeTimers();\n',
      { filename: "clock.test.ts" },
    ),
  ).resolves.toBeUndefined();
});

it("reports advancing Vitest time with the global vi", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { it } from "@effect/vitest";\nit.effect("expires", () => { vi.advanceTimersByTime(60_000); return check; });\n',
      { filename: "clock.test.ts" },
    ),
  ).resolves.toBeUndefined();
});

it("reports vi.setSystemTime imported through @effect/vitest", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { it, vi } from "@effect/vitest";\nvi.setSystemTime(0);\n', {
      filename: "clock.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows fake timers in plain Vitest files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { it, vi } from "vitest";\nvi.useFakeTimers();\n', {
      filename: "debounce.test.ts",
    }),
  ).resolves.toBeUndefined();
});

it("allows TestClock and unrelated vi helpers in Effect test files", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import { it } from "@effect/vitest";',
        'import { vi } from "vitest";',
        'import { TestClock } from "effect/testing";',
        "const spy = vi.fn();",
        'it.effect("expires", () => TestClock.adjust(60_000));',
        "",
      ].join("\n"),
      { filename: "clock.test.ts" },
    ),
  ).resolves.toBeUndefined();
});

it("ignores a local vi that shadows Vitest", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { it } from "@effect/vitest";\nconst vi = { useFakeTimers: () => undefined };\nvi.useFakeTimers();\n',
      { filename: "clock.test.ts" },
    ),
  ).resolves.toBeUndefined();
});
