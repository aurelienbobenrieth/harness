import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/bounded-retry";

it("reports an inline unbounded schedule", async () => {
  await expect(
    assertRuleReports(ruleName, 'const p = call.pipe(Effect.retry(Schedule.exponential("100 millis")));\n'),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, 'const p = Effect.retry(call, Schedule.spaced("1 second").pipe(Schedule.jittered));\n'),
  ).resolves.toBeUndefined();
});

it("reports unbounded schedules behind a same-file const or a schedule option", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const policy = Schedule.fixed("1 second");\nconst p = call.pipe(Effect.retry(policy));\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, 'const p = call.pipe(Effect.retry({ schedule: Schedule.exponential("1 second") }));\n'),
  ).resolves.toBeUndefined();
});

it("allows bounded policies", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const a = call.pipe(Effect.retry(Schedule.max([Schedule.exponential("100 millis"), Schedule.recurs(5)])));',
        'const b = call.pipe(Effect.retry(Schedule.exponential("100 millis").pipe(Schedule.upTo("30 seconds"))));',
        'const c = call.pipe(Effect.retry({ schedule: Schedule.spaced("1 second"), times: 3 }));',
        "const d = call.pipe(Effect.retry({ times: 3 }));",
        'const e = call.pipe(Effect.retry({ schedule: Schedule.spaced("1 second"), while: isTransient }));',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("skips policies it cannot see and intentionally unbounded repeats", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import { retryPolicy } from "./policies";',
        "const a = call.pipe(Effect.retry(retryPolicy));",
        'const b = call.pipe(Effect.retry(Schedule.max([Schedule.exponential("1 second"), retryPolicy])));',
        'const c = poll.pipe(Effect.repeat(Schedule.spaced("1 second")));',
        'const d = Other.retry(Schedule.spaced("1 second"));',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});
