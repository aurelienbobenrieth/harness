import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "xstate/require-effect-actor";

const effectMachine = `import { Effect } from "effect";
import { setupEffect } from "@xstate/effect";
const effectSetup = setupEffect({ actions: { audit: (_args: unknown) => Effect.log("audit") } });
export const reviewMachine = effectSetup.createMachine({
  initial: "pending",
  states: { pending: { on: { APPROVE: (args, enq) => { enq(args.actions.audit, args); return { target: "approved" }; } } }, approved: {} },
});
`;

it("reports createActor on a setupEffect machine", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { createActor } from "xstate";\n${effectMachine}export const actor = createActor(reviewMachine).start();\n`,
      {
        message: /createActor\(\) starts @xstate\/effect logic without an Effect host/,
      },
    ),
  ).resolves.toBeUndefined();
});

it("reports createActor on inline and bound fromEffect logic", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import { Effect, Stream } from "effect";
import { fromEffect, fromEffectStream } from "@xstate/effect";
import * as X from "xstate";
const load = fromEffect(({ input }: { input: { id: string } }) => Effect.succeed(input.id));
export const a = X.createActor(load, { input: { id: "1" } });
export const b = X.createActor(fromEffectStream(Stream.make(1, 2)));
`,
  );
  expect(messages).toHaveLength(2);
});

it("reports the @xstate/react hooks and createActorContext", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import { createActorContext, useActor, useActorRef, useMachine } from "@xstate/react";
${effectMachine}export const ReviewContext = createActorContext(reviewMachine);
export function Review() {
  const [snapshot] = useMachine(reviewMachine);
  const ref = useActorRef(reviewMachine.provide({}));
  const [other] = useActor(reviewMachine);
  return [snapshot, ref, other];
}
`,
  );
  expect(messages).toHaveLength(4);
  expect(messages.map((text) => text.split("(")[0])).toEqual([
    "createActorContext",
    "useMachine",
    "useActorRef",
    "useActor",
  ]);
});

it("reports a machine from an extended setupEffect", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { setupEffect } from "@xstate/effect";
import { createActor } from "xstate";
const base = setupEffect({});
const machine = base.extend({}).createMachine({ initial: "idle", states: { idle: {} } });
export const actor = createActor(machine);
`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts createEffectActor and createActorAtoms", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { Atom } from "effect/unstable/reactivity";
import { Layer } from "effect";
import { createEffectActor } from "@xstate/effect";
import { createActorAtoms } from "@xstate/effect/atom";
${effectMachine}export const program = Effect.scoped(Effect.gen(function* () { const actor = yield* createEffectActor(reviewMachine); actor.send({ type: "APPROVE" }); }));
export const review = createActorAtoms(Atom.runtime(Layer.empty), reviewMachine);
`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts plain xstate logic in createActor and hooks", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createActor, createMachine, setup } from "xstate";
import { useMachine } from "@xstate/react";
const toggle = setup({}).createMachine({ initial: "off", states: { off: { on: { TOGGLE: { target: "on" } } }, on: { on: { TOGGLE: { target: "off" } } } } });
const plain = createMachine({ initial: "idle", states: { idle: {} } });
export const actor = createActor(toggle).start();
export function Toggle() { const [snapshot] = useMachine(plain); return snapshot.value; }
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores lookalikes not imported from xstate or @xstate/effect", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createActor } from "./actors.js";
import { fromEffect, setupEffect } from "./effect-shim.js";
import { createActor as start } from "xstate";
export const a = createActor(fromEffect(1));
export const b = start(setupEffect({}).createMachine({}));
`,
    ),
  ).resolves.toBeUndefined();
});
