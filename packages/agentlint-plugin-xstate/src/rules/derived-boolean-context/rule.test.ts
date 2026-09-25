import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { defineDerivedBooleanContext, derivedBooleanContext } from "./rule.js";

const machineSource = "const machine = createMachine({ context: { canSubmit: false } });\n";

it("reports assign calls that cache availability flags", () => {
  const context = createContext({ filename: "assets/cart-machine.ts", sourceCode: machineSource });
  const visitors = createVisitors(derivedBooleanContext, context);

  visitors.call_expression?.(
    createNode("call_expression", "assign({ canSubmit: ({ context }) => context.items.length > 0 })"),
  );

  expect(context.messages).toHaveLength(1);
});

it("reports one finding per assign call even with several flags", () => {
  const context = createContext({ filename: "assets/cart-machine.ts", sourceCode: machineSource });
  const visitors = createVisitors(derivedBooleanContext, context);

  visitors.call_expression?.(createNode("call_expression", "assign({ canSubmit: true, isReady: true })"));

  expect(context.messages).toHaveLength(1);
});

it("reports persisted-looking booleans too; acceptance happens in the ledger", () => {
  // Judgment rules fire on the deterministic trigger; a boolean that is
  // intentionally persisted state (check 3) is accepted with a reason in the
  // ledger, not silenced here.
  const context = createContext({ filename: "assets/cart-machine.ts", sourceCode: machineSource });
  const visitors = createVisitors(derivedBooleanContext, context);

  visitors.call_expression?.(createNode("call_expression", "assign({ hasAcceptedTerms: true })"));

  expect(context.messages).toHaveLength(1);
});

it("ignores assign calls without availability flags", () => {
  const context = createContext({ filename: "assets/cart-machine.ts", sourceCode: machineSource });
  const visitors = createVisitors(derivedBooleanContext, context);

  visitors.call_expression?.(createNode("call_expression", "assign({ items: ({ event }) => event.items })"));

  expect(context.messages).toEqual([]);
});

it("ignores files without a machine definition", () => {
  const context = createContext({
    filename: "assets/form.ts",
    sourceCode: "const canSubmit = true;\n",
  });
  const visitors = createVisitors(derivedBooleanContext, context);

  visitors.call_expression?.(createNode("call_expression", "assign({ canSubmit: true })"));

  expect(context.messages).toEqual([]);
});

it("ignores unrelated calls", () => {
  const context = createContext({ filename: "assets/cart-machine.ts", sourceCode: machineSource });
  const visitors = createVisitors(derivedBooleanContext, context);

  visitors.call_expression?.(createNode("call_expression", "createMachine({ context: { canSubmit: false } })"));

  expect(context.messages).toEqual([]);
});

it("honours a configured contextFlagPattern", () => {
  const context = createContext({ filename: "assets/cart-machine.ts", sourceCode: machineSource });
  const rule = defineDerivedBooleanContext({ contextFlagPattern: /\ballow[A-Z]\w*\s*:/ });
  const visitors = createVisitors(rule, context);

  visitors.call_expression?.(createNode("call_expression", "assign({ allowCheckout: true })"));
  visitors.call_expression?.(createNode("call_expression", "assign({ canSubmit: true })"));

  expect(context.messages).toHaveLength(1);
});

it("reports enqueue.assign and setup-bound assign calls", () => {
  const context = createContext({ filename: "assets/cart-machine.ts", sourceCode: machineSource });
  const visitors = createVisitors(derivedBooleanContext, context);

  visitors.call_expression?.(createNode("call_expression", "enqueue.assign({ isReady: true })"));
  visitors.call_expression?.(createNode("call_expression", "machineSetup.assign({ canSubmit: true })"));

  expect(context.messages).toHaveLength(2);
});

it("ignores calls that merely contain an assign call or end in assign", () => {
  const context = createContext({ filename: "assets/cart-machine.ts", sourceCode: machineSource });
  const visitors = createVisitors(derivedBooleanContext, context);

  visitors.call_expression?.(createNode("call_expression", "enqueueActions(() => enqueue.assign({ isReady: true }))"));
  visitors.call_expression?.(createNode("call_expression", "reassign({ isReady: true })"));

  expect(context.messages).toEqual([]);
});

it("reports string-enum fields that mirror the finite state with a dedicated message", () => {
  const context = createContext({ filename: "assets/cart-machine.ts", sourceCode: machineSource });
  const visitors = createVisitors(derivedBooleanContext, context);

  visitors.call_expression?.(createNode("call_expression", 'assign({ status: "loading" })'));
  visitors.call_expression?.(createNode("call_expression", "assign({ status: ({ event }) => event.status, step: 2 })"));

  expect(context.messages).toHaveLength(1);
  expect(context.messages[0]).toContain("mirrors the finite state");
});

it("reports flags declared in the initial context of a machine definition", async () => {
  const source = `
const machine = setup({}).createMachine({
  context: { isLoading: false, items: [] },
  initial: "idle",
  states: { idle: {} },
});
`;
  await expect(
    testRuleOnSource({ rule: derivedBooleanContext, source: source, file: "src/cart-machine.ts" }),
  ).resolves.toHaveLength(1);
});

it("reports a status enum in a lazy initial context", async () => {
  const source = 'createMachine({ context: ({ input }) => ({ id: input.id, status: "idle" }) });';
  const findings = await testRuleOnSource({
    rule: derivedBooleanContext,
    source: source,
    file: "src/cart-machine.ts",
  });

  expect(findings).toHaveLength(1);
  expect(findings[0]?.message).toContain("mirrors the finite state");
});

it("reports types.context once when the initial context repeats the same flag", async () => {
  const source = `
const machine = setup({
  types: { context: {} as { isLoading?: boolean; phase: "a" | "b" } },
}).createMachine({ context: { isLoading: false, phase: "a" } });
`;
  await expect(
    testRuleOnSource({ rule: derivedBooleanContext, source: source, file: "src/cart-machine.ts" }),
  ).resolves.toHaveLength(1);
});

it("reports types.context when the initial context is not a literal the detector can read", async () => {
  const source = `
const machine = setup({
  types: { context: {} as { canCheckout: boolean } },
}).createMachine({ context: initialContext });
`;
  await expect(
    testRuleOnSource({ rule: derivedBooleanContext, source: source, file: "src/cart-machine.ts" }),
  ).resolves.toHaveLength(1);
});

it("ignores context keys that are not a machine context declaration", async () => {
  const source = `
const machine = createMachine({
  context: { items: [], status: initialStatus },
  invoke: { src: "load", input: ({ context }) => ({ context: { isLoading: true } }) },
});
render({ context: { isLoading: false } });
const types = { context: { isReady: true } };
`;
  await expect(
    testRuleOnSource({ rule: derivedBooleanContext, source: source, file: "src/cart-machine.ts" }),
  ).resolves.toEqual([]);
});

it("honours a configured stateMirrorPattern", async () => {
  const rule = defineDerivedBooleanContext({ stateMirrorPattern: /\bstage\s*:\s*"/ });
  const source = 'createMachine({ context: { stage: "one" } }); createMachine({ context: { status: "one" } });';

  await expect(testRuleOnSource({ rule: rule, source: source, file: "src/cart-machine.ts" })).resolves.toHaveLength(1);
});
