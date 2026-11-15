import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode, guidanceChecks } from "../test-support.js";
import { actorCleanup } from "./rule.js";

it("reports actor creation", () => {
  const context = createContext({ filename: "assets/cart-drawer.ts" });
  const visitors = createVisitors(actorCleanup, context);

  visitors.call_expression?.(createNode("call_expression", "createActor(cartMachine)"));

  expect(context.messages).toHaveLength(1);
});

it("ignores unrelated calls", () => {
  const context = createContext({ filename: "assets/cart-drawer.ts" });
  const visitors = createVisitors(actorCleanup, context);

  visitors.call_expression?.(createNode("call_expression", "createMachine({})"));

  expect(context.messages).toEqual([]);
});

it("ignores calls that only contain an actor creation", () => {
  const context = createContext({ filename: "assets/cart-drawer.ts" });
  const visitors = createVisitors(actorCleanup, context);

  visitors.call_expression?.(createNode("call_expression", "connect(() => createActor(cartMachine))"));

  expect(context.messages).toEqual([]);
});

it("excludes test files by default, where a leaked actor is harmless", () => {
  expect(actorCleanup.binding.exclude).toContain("**/*.{test,spec}.*");
});

it("carries the exit-action, React ownership and relaxed unsubscribe checks", () => {
  const checks = guidanceChecks(actorCleanup).join("\n");

  expect(checks).toContain("exit actions do not run when the root actor is stopped externally");
  expect(checks).toContain("fromCallback");
  expect(checks).toContain("useActorRef, useMachine or createActorContext");
  expect(checks).toContain("unless actor.stop() is proven");
});

it("reports v6 system actors and @xstate/effect actors with a scope-specific message", async () => {
  const source = `
import { createSystem } from "xstate";
import { createEffectActor, waitFor } from "@xstate/effect";
import { createActorAtoms } from "@xstate/effect/atom";

const system = createSystem({ registry: {} });
const checkout = system.createActor(checkoutMachine).start();

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  yield* waitFor(actor, (snapshot) => snapshot.matches("approved"));
});

const review = createActorAtoms(runtime, reviewMachine);
`;
  const findings = await testRuleOnSource({ rule: actorCleanup, source: source, file: "src/review.ts" });

  expect(findings.map((finding) => finding.message)).toEqual([
    "Actor creation: verify stop() runs on host teardown and teardown-critical cleanup is not left to exit actions.",
    "Effect actor creation: verify the enclosing Scope (Effect.scoped, a Layer under a disposed runtime) closes when the host goes away.",
    "Actor atoms creation: verify the atom registry is disposed when its owner shuts down, which releases the actor.",
  ]);
});

it("reports a wrapped creation once, at the creation call, and ignores v6 machine definitions", async () => {
  const source = `
const machine = createMachine({ entry: (_, enq) => enq.spawn("worker", { id: "w" }) });
const layer = Layer.effect(ReviewActor, createEffectActor(reviewMachine));
const recreate = createActorFactory(machine);
`;
  const findings = await testRuleOnSource({ rule: actorCleanup, source: source, file: "src/review.ts" });

  expect(findings.map((finding) => finding.message)).toEqual([
    "Effect actor creation: verify the enclosing Scope (Effect.scoped, a Layer under a disposed runtime) closes when the host goes away.",
  ]);
});

it("names the version-specific cleanup homes and the Effect scope owner", () => {
  const checks = guidanceChecks(actorCleanup).join("\n");

  expect(checks).toContain("v6 createCallbackLogic");
  expect(checks).toContain("abort signal");
  expect(checks).toContain("Effect.scoped(program)");
  expect(checks).toContain("createActorAtoms(...) actors are released when their atoms have no consumers");
});

it("reports a chained createActor(...).start() once", async () => {
  const source =
    "const actor = createActor(cartMachine).start();\nconst other = createActor(cartMachine, { input: {} }).start();";

  await expect(testRuleOnSource({ rule: actorCleanup, source: source, file: "src/cart.ts" })).resolves.toHaveLength(2);
});

it("stays silent when the file stops the stored actor on its teardown path", async () => {
  const source = `
class CartDrawer extends HTMLElement {
  #actor?: Actor;
  #pending = createActor(cartMachine);
  connectedCallback() {
    this.#actor = createActor(cartMachine);
    this.#actor.start();
  }
  disconnectedCallback() {
    this.#actor?.stop();
    this.#pending.stop();
  }
}
const local = createActor(cartMachine).start();
local.stop();
const typed = createActor(cartMachine) as CartActor;
typed?.stop();
`;

  await expect(testRuleOnSource({ rule: actorCleanup, source: source, file: "src/cart.ts" })).resolves.toEqual([]);
});

it("still reports an actor whose stop belongs to a different binding", async () => {
  const source = `
class CartDrawer extends HTMLElement {
  connectedCallback() {
    this.actor = createActor(cartMachine);
    const other = createActor(searchMachine);
    other.stop();
  }
  disconnectedCallback() {
    this.#actor.stop();
  }
}
const actor = createActor(cartMachine).start();
const unrelated = { actor: { stop() {} } };
unrelated.actor.stop();
createActor(cartMachine).start();
`;
  const findings = await testRuleOnSource({ rule: actorCleanup, source: source, file: "src/cart.ts" });

  expect(findings).toHaveLength(3);
});

it("does not treat a stop as proof for effect actors", async () => {
  const source = `
const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  actor.stop();
});
`;

  await expect(testRuleOnSource({ rule: actorCleanup, source: source, file: "src/review.ts" })).resolves.toHaveLength(
    1,
  );
});

it("follows the stored actor into the field it is copied to", async () => {
  const source = `
class Search extends HTMLElement {
  #actor?: Actor;
  connectedCallback() {
    const actor = createActor(searchMachine);
    this.#actor = actor;
    actor.start();
  }
  disconnectedCallback() {
    this.#actor?.stop();
  }
}
class Leaky extends HTMLElement {
  connectedCallback() {
    const actor = createActor(searchMachine);
    this.actor = actor;
    actor.start();
  }
}
`;
  const findings = await testRuleOnSource({ rule: actorCleanup, source: source, file: "src/search.ts" });

  expect(findings.map((finding) => finding.line)).toEqual([15]);
});
