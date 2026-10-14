import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/require-event-satisfies";

it("reports bare object events passed to send", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createActor } from "xstate"; const actorRef = createActor(machine); actorRef.send({ type: "ADD_ITEM", id: "x" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports bare object events passed to raise", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { raise } from "xstate"; const action = raise({ type: "RETRY" });\nconsole.log(action);\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports bare object events passed to sendTo", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { sendTo } from "xstate"; const action = sendTo("cart", { type: "SYNC" });\nconsole.log(action);\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts satisfies-checked object events", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'type CartEvent = { type: "ADD_ITEM" };\nactorRef.send({ type: "ADD_ITEM" } satisfies CartEvent);\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts non-literal event expressions", async () => {
  await expect(assertRuleDoesNotReport(ruleName, "actorRef.send(event);\n")).resolves.toBeUndefined();
});

it("ignores object arguments without a type property", async () => {
  await expect(assertRuleDoesNotReport(ruleName, 'send({ to: "cart" });\n')).resolves.toBeUndefined();
});

it("ignores the sendTo target argument", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'type CartEvent = { type: "SYNC" };\nconst action = sendTo({ type: "actor" }, { type: "SYNC" } satisfies CartEvent);\nconsole.log(action);\n',
    ),
  ).resolves.toBeUndefined();
});

it("honours configured callee names", async () => {
  await expect(
    assertRuleReports(ruleName, 'dispatch({ type: "ADD_ITEM" });\n', {
      ruleOptions: { sendCalleeNames: ["dispatch"] },
    }),
  ).resolves.toBeUndefined();
});

it("does not match callees outside the configured names", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createActor } from "xstate"; const actorRef = createActor(machine); actorRef.send({ type: "ADD_ITEM" });\n',
      {
        ruleOptions: { sendCalleeNames: ["dispatch"] },
      },
    ),
  ).resolves.toBeUndefined();
});

it('accepts regression: response.send({ type: "json" });', async () => {
  await assertRuleDoesNotReport(ruleName, 'response.send({ type: "json" });');
});

it("reports bare events passed to enqueue.raise and enqueue.sendTo", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { enqueueActions } from "xstate";\nexport const a = enqueueActions(({ enqueue }) => { enqueue.raise({ type: "RETRY" }); });\nexport const b = enqueueActions(({ enqueue }) => { enqueue.sendTo("cart", { type: "SYNC" }); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports bare events passed to sendParent", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { sendParent } from "xstate";\nexport const a = sendParent({ type: "DONE" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports bare events passed to emit", async () => {
  await expect(
    assertRuleReports(ruleName, 'import { emit } from "xstate";\nexport const a = emit({ type: "notified" });\n'),
  ).resolves.toBeUndefined();
});

it("reports send on a useActorRef result", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useActorRef } from "@xstate/react";\nexport function Cart() { const actorRef = useActorRef(cartMachine); actorRef.send({ type: "ADD_ITEM" }); return null; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports the send function of the useMachine tuple", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useMachine } from "@xstate/react";\nexport function Cart() { const [snapshot, dispatch] = useMachine(cartMachine); dispatch({ type: "ADD_ITEM" }); return snapshot.value; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports send on the actor ref of the useActor tuple", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useActor } from "@xstate/react";\nexport function Cart() { const [snapshot, , ref] = useActor(cartMachine); ref.send({ type: "ADD_ITEM" }); return snapshot.value; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports send on an actor-context useActorRef result", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createActorContext } from "@xstate/react";\nconst CartContext = createActorContext(cartMachine);\nexport function Cart() { const ref = CartContext.useActorRef(); ref.send({ type: "ADD_ITEM" }); return null; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts satisfies-checked events on the new senders", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { enqueueActions } from "xstate";\nimport { useMachine } from "@xstate/react";\ntype E = { type: "RETRY" };\nexport const a = enqueueActions(({ enqueue }) => { enqueue.raise({ type: "RETRY" } satisfies E); });\nexport function Cart() { const [, send] = useMachine(cartMachine); send({ type: "RETRY" } satisfies E); return null; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores an enqueue object that is not an enqueueActions parameter", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { setup } from "xstate";\nconst enqueue = createQueue();\nenqueue.raise({ type: "RETRY" });\nconsole.log(setup);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores tuple sends from hooks outside @xstate/react", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useMachine } from "./hooks.js";\nexport function Cart() { const [, send] = useMachine(cartMachine); send({ type: "RETRY" }); return null; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores the snapshot slot of the tuple", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useMachine } from "@xstate/react";\nexport function Cart() { const [snapshot] = useMachine(cartMachine); snapshot.send({ type: "RETRY" }); return null; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports bare events passed to the XState v6 enq.raise, enq.sendTo and enq.emit", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createMachine } from "xstate";\nexport const a = createMachine({ on: { next: (_, enq) => { enq.raise({ type: "done" }); } } });\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'import { createMachine } from "xstate";\nexport const a = createMachine({ on: { done: ({ parent }, enq) => { enq.sendTo(parent, { type: "done" }); } } });\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'import { setupEffect } from "@xstate/effect";\nexport const a = setupEffect({}).createMachine({ entry: (_, enq) => { enq.emit({ type: "started" }); } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports bare events passed to enq.sendBack in an XState v6 createLogic run", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createLogic } from "xstate";\nexport const logic = createLogic({ context: {}, run: (_, enq) => { enq.sendBack({ type: "done" }); } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports bare events passed to @xstate/effect send in both forms", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { send } from "@xstate/effect";\nexport const program = (actor: any) => send(actor, { type: "next" });\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'import { send } from "@xstate/effect";\nexport const next = send({ type: "next" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports send on a yielded createEffectActor and on a system.createActor ref", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createEffectActor } from "@xstate/effect";\nimport { Effect } from "effect";\nexport const program = Effect.gen(function* () { const actor = yield* createEffectActor(machine); actor.send({ type: "next" }); });\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'import { createSystem } from "xstate";\nconst system = createSystem({ registry: {} });\nconst actor = system.createActor(machine);\nactor.send({ type: "next" });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts satisfies-checked events on the XState v6 and @xstate/effect senders", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "xstate";\nimport { send } from "@xstate/effect";\ntype E = { type: "next" } | { type: "done" };\nexport const a = createMachine({ on: { next: ({ parent }, enq) => { enq.raise({ type: "done" } satisfies E); enq.sendTo(parent, { type: "done" } satisfies E); } } });\nexport const b = (actor: any) => send(actor, { type: "next" } satisfies E);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores the actor argument of @xstate/effect send and enq.sendTo targets", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "xstate";\nimport { send } from "@xstate/effect";\ntype E = { type: "next" };\nexport const a = createMachine({ on: { next: (_, enq) => { enq.sendTo({ type: "actor" } as any, { type: "next" } satisfies E); } } });\nexport const b = send({ type: "actor" } as any, { type: "next" } satisfies E);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores a second parameter of functions outside XState v6 handler hosts", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "xstate";\nexport function relay(_: unknown, bus: { raise(event: unknown): void }) { bus.raise({ type: "next" }); }\nexport const m = createMachine({ on: { next: () => { const relays = { forward: (_: unknown, bus: any) => bus.raise({ type: "next" }) }; console.log(relays); } } });\n',
    ),
  ).resolves.toBeUndefined();
});
