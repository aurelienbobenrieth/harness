import { expect, it } from "vitest";
import { fixCode } from "../sota-test-support.ts";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-fork-detach";

const layerWith = (fork: string, tail = ""): string =>
  [
    "const WorkerLive = Layer.effect(",
    "  Worker,",
    "  Effect.gen(function* () {",
    `    const fiber = yield* ${fork}(pollQueue);`,
    tail,
    "    return { stop: Effect.void };",
    "  }),",
    ");",
    "",
  ].join("\n");

it("reports Effect.forkDetach as a call and as a pipe argument", async () => {
  await expect(
    assertRuleReports(ruleName, "const p = Effect.gen(function* () { yield* Effect.forkDetach(heartbeat); });\n"),
  ).resolves.toBeUndefined();
  await expect(assertRuleReports(ruleName, "const p = heartbeat.pipe(Effect.forkDetach);\n")).resolves.toBeUndefined();
});

it("reports Effect.forkChild directly inside a Layer constructor", async () => {
  await expect(assertRuleReports(ruleName, layerWith("Effect.forkChild"))).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "const Live = Layer.effectDiscard(Effect.gen(function* () { yield* Effect.forkChild(poll); }).pipe(Effect.withSpan('live')));\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows forkScoped in layers and forkChild elsewhere", async () => {
  await expect(assertRuleDoesNotReport(ruleName, layerWith("Effect.forkScoped"))).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "const p = Effect.gen(function* () { const fiber = yield* Effect.forkChild(task); return fiber; });\n",
    ),
  ).resolves.toBeUndefined();
});

it("allows forkChild in service methods returned by the layer and children joined by the constructor", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const Live = Layer.effect(",
        "  Worker,",
        "  Effect.gen(function* () {",
        '    const run = Effect.fn("Worker.run")(function* (job: Job) { return yield* Effect.forkChild(execute(job)); });',
        "    return { run };",
        "  }),",
        ");",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, layerWith("Effect.forkChild", "    yield* Fiber.join(fiber);")),
  ).resolves.toBeUndefined();
});

it("allows forkDetach in configured files", async () => {
  await expect(
    assertRuleDoesNotReport(ruleName, "const p = heartbeat.pipe(Effect.forkDetach);\n", {
      filename: "src/daemons/heartbeat.ts",
      ruleConfig: ["error", { allow: ["**/daemons/**"] }],
    }),
  ).resolves.toBeUndefined();
});

it("suggests forkScoped for layer constructors", async () => {
  await expect(fixCode(ruleName, layerWith("Effect.forkChild"), "suggestions")).resolves.toBe(
    layerWith("Effect.forkScoped"),
  );
});
