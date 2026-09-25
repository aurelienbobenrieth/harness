import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/no-machine-in-render";

it("reports setup().createMachine in a component body", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { createActor, createMachine, setup } from "xstate";\nexport function Cart() { const machine = setup({ types: {} }).createMachine({}); const [snapshot] = useMachine(machine); return snapshot.value; }\n',
      { filename: "cart.tsx" },
    ),
  ).resolves.toBeUndefined();
});

it("reports createActor in an arrow component", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { createActor, createMachine, setup } from "xstate";\nexport const Cart = () => { const actor = createActor(cartMachine).start(); return actor.id; };\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports createMachine in a custom hook", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { createActor, createMachine, setup } from "xstate";\nexport function useCart() { return useMachine(createMachine({})); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports createMachine through a module-level setup binding", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { createActor, createMachine, setup } from "xstate";\nconst cartSetup = setup({ types: {} });\nexport function Cart() { const machine = cartSetup.createMachine({}); return useMachine(machine)[0].value; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports inside memo-wrapped components", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { memo } from "react";\nimport { useMachine } from "@xstate/react";\nimport { createActor, createMachine, setup } from "xstate";\nexport const Cart = memo(() => { const machine = createMachine({}); return useMachine(machine)[0].value; });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts machines defined at module scope", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { createActor, createMachine, setup } from "xstate";\nconst cartMachine = setup({ types: {} }).createMachine({});\nexport function Cart({ id }: { id: string }) { const [snapshot] = useMachine(cartMachine, { input: { id } }); return snapshot.value; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts machine.provide in render", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { createActor, createMachine, setup } from "xstate";\nconst cartMachine = setup({ types: {} }).createMachine({});\nexport function Cart() { const [snapshot] = useMachine(cartMachine.provide({ actions: {} })); return snapshot.value; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts creation inside nested callbacks", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useMemo, useEffect } from "react";\nimport { useMachine } from "@xstate/react";\nimport { createActor, createMachine, setup } from "xstate";\nexport function Cart() { const machine = useMemo(() => createMachine({}), []); useEffect(() => { const actor = createActor(machine).start(); return () => actor.stop(); }, [machine]); return null; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores camelCase factories", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { createActor, createMachine, setup } from "xstate";\nexport function buildCartMachine() { return createMachine({}); }\nconsole.log(useMachine, createActor, setup);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores files without a React import", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createMachine } from "xstate";\nexport function Cart() { return createMachine({}); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores createMachine from another module", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { createMachine } from "./factory.js";\nexport function Cart() { return useMachine(createMachine({})); }\n',
    ),
  ).resolves.toBeUndefined();
});
