import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineResiliencePolicy, resiliencePolicy } from "./rule.js";

const unboundedMessage =
  "Retry shows no attempt or time bound; add `times`, `Schedule.recurs`, `Schedule.upTo` or `Schedule.during` and restrict it to retryable failures.";
const reviewMessage =
  "Retry policy: confirm the bound, jitter, retryable-only predicate, per-attempt timeout and idempotency of the retried effect.";
const timeoutMessage =
  "Outbound effect shows no timeout; apply `Effect.timeout` in its pipeline or confirm the client enforces one.";

async function messages(source: string, rule = resiliencePolicy): Promise<ReadonlyArray<string>> {
  const findings = await testRuleOnSource(rule, source, "src/module.ts");
  return findings.map((finding) => finding.message);
}

it("reports a retry built from an unbounded schedule", async () => {
  expect(await messages('const resilient = request.pipe(Effect.retry(Schedule.spaced("1 second")));')).toEqual([
    unboundedMessage,
  ]);
});

it("reports a retry without a policy argument", async () => {
  expect(await messages("const resilient = request.pipe(Effect.retry());")).toEqual([unboundedMessage]);
});

it("schedules review of a bounded inline retry", async () => {
  expect(
    await messages(
      'const resilient = Effect.retry(request, { times: 3, schedule: Schedule.exponential("100 millis") });',
    ),
  ).toEqual([reviewMessage]);
});

it("schedules review of a retry that references a named schedule", async () => {
  expect(await messages("const resilient = request.pipe(Effect.retry(upstreamRetryPolicy));")).toEqual([reviewMessage]);
});

it("reports retryOrElse the same way", async () => {
  expect(
    await messages('const resilient = Effect.retryOrElse(request, Schedule.fixed("1 second"), () => fallback);'),
  ).toEqual([unboundedMessage]);
});

it("reports an outbound tryPromise without a timeout", async () => {
  expect(
    await messages("const load = (url: string) => Effect.tryPromise({ try: () => fetch(url), catch: toError });"),
  ).toEqual([timeoutMessage]);
});

it("reports HttpClient calls without a timeout", async () => {
  expect(
    await messages("const load = Effect.fn('load')(function* () { return yield* HttpClient.get(url); });"),
  ).toEqual([timeoutMessage]);
});

it("stays silent when the pipeline applies a timeout", async () => {
  expect(
    await messages(
      'const load = (url: string) => Effect.tryPromise({ try: () => fetch(url), catch: toError }).pipe(Effect.timeout("2 seconds"));',
    ),
  ).toEqual([]);
});

it("does not let a timeout in a sibling function silence an outbound call", async () => {
  expect(
    await messages(
      [
        "const service = {",
        "  load: (url: string) => Effect.tryPromise({ try: () => fetch(url), catch: toError }),",
        '  save: (url: string) => Effect.tryPromise({ try: () => fetch(url), catch: toError }).pipe(Effect.timeout("1 second")),',
        "};",
      ].join("\n"),
    ),
  ).toEqual([timeoutMessage]);
});

it("reports the retry once and not the outbound call it wraps", async () => {
  expect(
    await messages(
      "const load = (url: string) => Effect.tryPromise({ try: () => fetch(url), catch: toError }).pipe(Effect.retry({ times: 2 }));",
    ),
  ).toEqual([reviewMessage]);
});

it("ignores Effect calls that are neither retries nor outbound", async () => {
  expect(
    await messages("const parsed = Effect.try(parse); const queued = retryQueue(job); const x = Effect.retryable(y);"),
  ).toEqual([]);
});

it("supports a custom outbound call pattern", async () => {
  const rule = defineResiliencePolicy({ outboundCallPattern: /^stripe\.\w+\.\w+\s*\(/u });

  expect(await messages("const charge = () => stripe.charges.create(input);", rule)).toEqual([timeoutMessage]);
  expect(await messages("const load = () => Effect.tryPromise(run);", rule)).toEqual([]);
});
