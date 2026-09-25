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
