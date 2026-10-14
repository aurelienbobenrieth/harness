import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "xstate/no-persist-live-snapshot";

const machine = `const checkoutMachine = createMachine({ id: "checkout", version: "1", initial: "cart", states: { cart: {} } });\n`;

it("reports JSON.stringify of getSnapshot() on a started actor", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `import { createActor, createMachine } from "xstate";
${machine}const actor = createActor(checkoutMachine).start();
localStorage.setItem("checkout", JSON.stringify(actor.getSnapshot()));
`,
      { message: /JSON\.stringify of a live snapshot.*Serialize actor\.getPersistedSnapshot\(\) instead/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports a bound snapshot, a subscribe listener snapshot, and a useMachine snapshot", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import { createActor, createMachine } from "xstate";
import { useMachine } from "@xstate/react";
${machine}const actor = createActor(checkoutMachine);
const snapshot = actor.getSnapshot();
export const saved = JSON.stringify(snapshot);
actor.subscribe((next) => sessionStorage.setItem("checkout", JSON.stringify(next)));
export function Checkout() {
  const [state] = useMachine(checkoutMachine);
  localStorage.setItem("checkout", JSON.stringify(state));
  return state.value;
}
`,
  );
  expect(messages).toHaveLength(3);
});

it("accepts getPersistedSnapshot and parts of the live snapshot", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createActor, createMachine } from "xstate";
${machine}const actor = createActor(checkoutMachine).start();
localStorage.setItem("checkout", JSON.stringify(actor.getPersistedSnapshot()));
export const context = JSON.stringify(actor.getSnapshot().context);
actor.subscribe(() => localStorage.setItem("checkout", JSON.stringify(actor.getPersistedSnapshot())));
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores getSnapshot on values not provably actors and a shadowed JSON", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `import { createActor } from "./actors.js";
import { createActor as realCreateActor, createMachine } from "xstate";
${machine}const store = createActor();
export const a = JSON.stringify(store.getSnapshot());
export function save(editor: { getSnapshot(): unknown }) { return JSON.stringify(editor.getSnapshot()); }
export function withLocalJson(JSON: { stringify(value: unknown): string }) { return JSON.stringify(realCreateActor(checkoutMachine).getSnapshot()); }
`,
    ),
  ).resolves.toBeUndefined();
});
