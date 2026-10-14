import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineEffectActorObserved, effectActorObserved } from "./rule.js";

it("reports an Effect actor that is only sent events", async () => {
  const source = `
import { Effect } from "effect";
import { createEffectActor, send } from "@xstate/effect";

const program = Effect.gen(function* () {
  const deployment = yield* createEffectActor(deployMachine, { input: { release } });
  yield* send(deployment, { type: "START" });
});
`;
  const findings = await testRuleOnSource({ rule: effectActorObserved, source: source, file: "src/deploy.ts" });

  expect(findings.map((finding) => [finding.line, finding.message])).toEqual([
    [
      6,
      "Effect actor 'deployment' is never joined, awaited or streamed: its failure stays silent; read its outcome with join, waitFor, snapshots or subscribe.",
    ],
  ]);
});

it("stays silent when the actor is joined, waited for, streamed, subscribed, piped or returned", async () => {
  const observations = [
    "return yield* join(actor);",
    'yield* waitFor(actor, (s) => s.matches("done"), { timeout: "5 seconds" });',
    "yield* snapshots(actor).pipe(Stream.runCollect);",
    "actor.subscribe({ error: (error) => console.error(error) });",
    'yield* pipe(actor, waitFor((s) => s.matches("done")));',
    "return actor;",
  ];
  const findings = await Promise.all(
    observations.map((observation) =>
      testRuleOnSource({
        rule: effectActorObserved,
        source: `const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  ${observation}
});`,
        file: "src/review.ts",
      }),
    ),
  );

  expect(findings).toEqual(observations.map(() => []));
});

it("does not mistake another actor's observation or emitted() for this actor's", async () => {
  const source = `
const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  const other = yield* createEffectActor(otherMachine);
  yield* join(other);
  yield* emitted(actor).pipe(Stream.take(1), Stream.runCollect);
  yield* waitFor(actorList, (s) => s.matches("done"));
});
`;
  const findings = await testRuleOnSource({ rule: effectActorObserved, source: source, file: "src/review.ts" });

  expect(findings.map((finding) => finding.message)).toEqual([
    "Effect actor 'actor' is never joined, awaited or streamed: its failure stays silent; read its outcome with join, waitFor, snapshots or subscribe.",
  ]);
});

it("stays silent on unbound creations handed to another owner and on xstate createActor", async () => {
  const source = `
const ReviewActorLayer = Layer.effect(ReviewActor, createEffectActor(reviewMachine));
const run = () => Effect.scoped(createEffectActor(task));
const plain = createActor(reviewMachine).start();
`;
  await expect(testRuleOnSource({ rule: effectActorObserved, source: source, file: "src/review.ts" })).resolves.toEqual(
    [],
  );
});

it("honours configured observer names", async () => {
  const rule = defineEffectActorObserved({ observerNames: ["awaitOutcome"] });
  const source = `
const a = yield* createEffectActor(m);
yield* awaitOutcome(a);
const b = yield* createEffectActor(m);
yield* join(b);
`;
  const findings = await testRuleOnSource({ rule: rule, source: source, file: "src/m.ts" });

  expect(findings.map((finding) => finding.line)).toEqual([4]);
});
