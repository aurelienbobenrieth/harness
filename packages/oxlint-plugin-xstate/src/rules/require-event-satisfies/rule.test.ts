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
