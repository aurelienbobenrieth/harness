import { describe, expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.ts";

const ruleName = "effect/telemetry-name-format";

const spanName = (name: string): string =>
  `Rename the span name "${name}" to lowercase dotted snake_case with at least 2 dot-separated segments, like "area.operation": tracing backends index it, and one shape keeps it searchable.`;
const key = (kind: string, name: string): string =>
  `Rename the ${kind} key "${name}" to lowercase dotted snake_case, like "order_id": telemetry backends index it, and one shape keeps it searchable.`;

it("reports Effect.fn span names that are not lowercase dotted snake_case", async () => {
  await expect(
    reportedMessages(
      ruleName,
      [
        'import { Effect } from "effect";',
        'const create = Effect.fn("TodoRepo.create")(function* () {});',
        'const load = Effect.fn("load")(function* () {});',
        'const sync = Effect.fn("orders.syncAll", { attributes: { orderId: 1 } })(function* () {});',
        "",
      ].join("\n"),
    ),
  ).resolves.toEqual([
    spanName("TodoRepo.create"),
    spanName("load"),
    spanName("orders.syncAll"),
    key("span attribute", "orderId"),
  ]);
});

it("reports span names on withSpan data-last and data-first, and the other span constructors", async () => {
  const lines = [
    'const a = load.pipe(Effect.withSpan("LoadUser"));',
    'const b = Effect.withSpan(load, "users-load");',
    'const c = Effect.withSpan(load, "users.Load", { kind: "internal" });',
    'const d = load.pipe(Effect.withSpanScoped("users"));',
    'const e = Effect.useSpan("Job.Run", (span) => work(span));',
    'const f = Effect.makeSpan("job run");',
    'const g = Effect.makeSpanScoped("job");',
    'const h = DbLive.pipe(Layer.withSpan("DbLive"));',
    'const i = source.pipe(Stream.withSpan("events"));',
  ];
  await expect(reportedMessages(ruleName, `${lines.join("\n")}\n`)).resolves.toHaveLength(lines.length);
});

it("reports Rpc.make tags imported from effect/unstable/rpc", async () => {
  await expect(
    reportedMessages(
      ruleName,
      'import * as Rpc from "effect/unstable/rpc/Rpc";\nexport const GetUser = Rpc.make("GetUser", {});\n',
    ),
  ).resolves.toEqual([
    'Rename the RPC name "GetUser" to lowercase dotted snake_case with at least 2 dot-separated segments, like "area.operation": tracing backends index it, and one shape keeps it searchable.',
  ]);
  await expect(
    assertRuleReports(ruleName, 'import { Rpc } from "effect/unstable/rpc";\nconst ListJobs = Rpc.make("jobs");\n'),
  ).resolves.toBeUndefined();
});

it("reports annotation keys in record and single-key forms, and withSpan attribute keys", async () => {
  await expect(
    reportedMessages(
      ruleName,
      [
        'import { Effect } from "effect";',
        'const a = program.pipe(Effect.annotateLogs({ orderId, "job.queue": queue, "Wake-Up": 1 }));',
        "const b = Effect.annotateSpans(program, { shopDomain: domain });",
        'const c = Effect.annotateCurrentSpan("userId", id);',
        'const d = Effect.annotateLogs(program, "requestId", id);',
        'const e = program.pipe(Effect.withSpan("orders.sync", { attributes: { OrderCount: n } }));',
        "const f = Effect.annotateLogsScoped({ traceId: id });",
        "",
      ].join("\n"),
    ),
  ).resolves.toEqual([
    key("log annotation", "orderId"),
    key("log annotation", "Wake-Up"),
    key("span annotation", "shopDomain"),
    key("span annotation", "userId"),
    key("log annotation", "requestId"),
    key("span attribute", "OrderCount"),
    key("log annotation", "traceId"),
  ]);
});

it("allows executor-style names and keys", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import { Effect, Layer } from "effect";',
        'import * as Rpc from "effect/unstable/rpc/Rpc";',
        'const verify = Effect.fn("mcp.auth.verify_api_key")(function* () {});',
        'const sync = Effect.fn("workos_events.sync", { attributes: { "org.id": id, event: "x" } })(function* () {});',
        'const traced = load.pipe(Effect.withSpan("users.load", { attributes: { user_id: id } }));',
        'const traced2 = Effect.withSpan(load, "users.load_all");',
        'const layer = DbLive.pipe(Layer.withSpan("db.connect"));',
        'const ListJobs = Rpc.make("jobs.list", {});',
        'const a = program.pipe(Effect.annotateLogs({ event: "job.dead", handler, "wake_up.lag_ms": lag }));',
        'const b = Effect.annotateCurrentSpan("mcp.execute.outcome", "paused");',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("skips non-literal names, computed and spread keys, untraced functions, and non-Effect calls", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'import { Effect } from "effect";',
        "const load = Effect.fn(spanName)(function* () {});",
        "const fn = Effect.fn(function* () {});",
        "const untraced = Effect.fnUntraced(function* () {});",
        "const traced = Effect.withSpan(load, name, { attributes: { [dynamicKey]: 1, ...extra } });",
        "const a = Effect.annotateLogs(annotations);",
        'const b = tracer.withSpan("LoadUser", run);',
        "const c = logger.annotateLogs({ orderId });",
        'const d = Other.make("GetUser");',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("ignores an Rpc imported from outside Effect", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'import { Rpc } from "./local-rpc";\nconst GetUser = Rpc.make("GetUser");\n'),
  ).resolves.toBeUndefined();
});

it("honours pattern, keyPattern and minSegments", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, 'const load = Effect.fn("load")(function* () {});\n', {
      ruleOptions: { minSegments: 1 },
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'const create = Effect.fn("TodoRepo.create")(function* () {});\nconst a = Effect.annotateLogs({ orderId });\n',
      { ruleOptions: { pattern: "^[A-Z][A-Za-z]*(\\.[a-z][A-Za-z]*)+$", keyPattern: "^[a-z][A-Za-z]*$" } },
    ),
  ).resolves.toBeUndefined();
  await expect(
    reportedMessages(ruleName, 'const a = Effect.fn("orders.sync")(function* () {});\n', {
      ruleOptions: { minSegments: 3 },
    }),
  ).resolves.toEqual([
    'Rename the span name "orders.sync" to lowercase dotted snake_case with at least 3 dot-separated segments, like "area.operation": tracing backends index it, and one shape keeps it searchable.',
  ]);
  await expect(
    reportedMessages(ruleName, 'const a = Effect.withSpan(load, "orders");\n', {
      ruleOptions: { pattern: "^[a-z]+(\\.[a-z]+)*$" },
    }),
  ).resolves.toEqual([
    'Rename the span name "orders" to match /^[a-z]+(\\.[a-z]+)*$/ with at least 2 dot-separated segments: tracing backends index it, and one shape keeps it searchable.',
  ]);
});

const logName = (name: string): string =>
  `Rename the log event "${name}" to lowercase dotted snake_case with at least 2 dot-separated segments, like "area.operation": log backends search and count by it, and one shape keeps it searchable.`;
const logLiteral = (callee: string): string =>
  `Start ${callee} with a literal event name like "webhook.rejected": log backends search and count by it. Pass the values as later arguments or through Effect.annotateLogs.`;

describe("logMessages", () => {
  const logMessages = { ruleOptions: { logMessages: true } };

  it("leaves log messages alone by default", async () => {
    await expect(
      assertRuleDoesNotReport(ruleName, 'Effect.logInfo("Webhook rejected");\nEffect.log(`webhook.${kind}`);\n'),
    ).resolves.toBeUndefined();
  });

  it("reports literal log messages that are not event names", async () => {
    await expect(
      reportedMessages(
        ruleName,
        [
          'Effect.logInfo("Webhook rejected");',
          'Effect.log("webhook");',
          'Effect.logError("webhook.Rejected");',
          'Effect.logWarning("webhook..rejected");',
          'Effect.logDebug("webhook-rejected.x");',
          'const retry = Effect.gen(function* () {\n  yield* Effect.logWarning("retry", { attempt });\n});',
          "",
        ].join("\n"),
        logMessages,
      ),
    ).resolves.toEqual([
      logName("Webhook rejected"),
      logName("webhook"),
      logName("webhook.Rejected"),
      logName("webhook..rejected"),
      logName("webhook-rejected.x"),
      logName("retry"),
    ]);
  });

  it("reports a log call whose first argument is not a literal", async () => {
    await expect(
      reportedMessages(
        ruleName,
        [
          "Effect.logFatal(42);",
          "Effect.logTrace();",
          "Effect.logInfo(`webhook.${kind}`);",
          'Effect.logInfo(ok ? "webhook.accepted" : "webhook.rejected");',
          "Effect.logInfo(eventName);",
          'Effect.logInfo("webhook." + kind);',
          "Effect.logInfo(...args);",
          "Effect.logInfo(names.rejected);",
          "",
        ].join("\n"),
        logMessages,
      ),
    ).resolves.toEqual([
      logLiteral("Effect.logFatal"),
      logLiteral("Effect.logTrace"),
      ...Array.from({ length: 6 }, () => logLiteral("Effect.logInfo")),
    ]);
  });

  it.each([
    ['import { logInfo } from "effect/Effect";\nlogInfo("Started");\n', "logInfo"],
    ['import { logInfo as info } from "effect/Effect";\ninfo("Started");\n', "info"],
    ['import * as Fx from "effect/Effect";\nFx.logInfo("Started");\n', "Fx.logInfo"],
    ['import { Effect as Fx } from "effect";\nFx.logInfo("Started");\n', "Fx.logInfo"],
  ])("recognizes the log function through its import: %s", async (code) => {
    await expect(reportedMessages(ruleName, code, logMessages)).resolves.toEqual([logName("Started")]);
  });

  it("names the log function as the call writes it", async () => {
    await expect(
      reportedMessages(ruleName, 'import { logInfo as info } from "effect/Effect";\ninfo(event);\n', logMessages),
    ).resolves.toEqual([logLiteral("info")]);
  });

  it("allows event names, static templates, and calls that are not Effect log functions", async () => {
    await expect(
      assertRuleDoesNotReport(
        ruleName,
        [
          'import { logInfo as local } from "./logger.ts";',
          'import * as Local from "./effect.ts";',
          'Effect.logInfo("webhook.rejected");',
          'Effect.log("job.retry_scheduled", { attempt: 2 });',
          'Effect.logError("shop.sync.failed_2", cause);',
          "Effect.logInfo(`webhook.rejected`);",
          'const logged = Effect.logInfo("webhook.rejected").pipe(Effect.annotateLogs({ shop }));',
          'Effect.logSpan("Webhook rejected");',
          'console.log("Webhook rejected");',
          'Logger.logInfo("Webhook rejected");',
          'Effect["logInfo"]("Webhook rejected");',
          'logInfo("Webhook rejected");',
          'local("Webhook rejected");',
          'Local.logInfo("Webhook rejected");',
          "",
        ].join("\n"),
        logMessages,
      ),
    ).resolves.toBeUndefined();
  });

  it("applies pattern and minSegments to log event names", async () => {
    await expect(
      assertRuleDoesNotReport(ruleName, 'Effect.logInfo("started");\n', {
        ruleOptions: { logMessages: true, minSegments: 1 },
      }),
    ).resolves.toBeUndefined();
    await expect(
      reportedMessages(ruleName, 'Effect.logInfo("webhook.rejected");\n', {
        ruleOptions: { logMessages: true, pattern: "^[A-Z][a-z]*(\\.[A-Z][a-z]*)+$" },
      }),
    ).resolves.toEqual([
      'Rename the log event "webhook.rejected" to match /^[A-Z][a-z]*(\\.[A-Z][a-z]*)+$/ with at least 2 dot-separated segments: log backends search and count by it, and one shape keeps it searchable.',
    ]);
  });
});
