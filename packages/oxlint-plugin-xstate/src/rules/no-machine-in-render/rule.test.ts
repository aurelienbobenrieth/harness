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

it("reports the XState v6 system.createActor in a component body", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useSelector } from "@xstate/react";\nimport { createSystem } from "xstate";\nconst system = createSystem({ registry: {} });\nexport function Cart() { const actor = system.createActor(cartMachine).start(); return useSelector(actor, (s) => s.value); }\n',
      { message: /createActor\(\) runs on every render here/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports setupEffect().createMachine and system.setup().createMachine in a component body", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { setupEffect } from "@xstate/effect";\nexport function Cart() { const [snapshot] = useMachine(setupEffect({}).createMachine({})); return snapshot.value; }\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'import { useMachine } from "@xstate/react";\nimport { createSystem } from "xstate";\nconst system = createSystem({ registry: {} });\nexport function Cart() { const [snapshot] = useMachine(system.setup().createMachine({})); return snapshot.value; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports createActorAtoms in a component body", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useAtomValue } from "@effect/atom-react";\nimport { createActorAtoms } from "@xstate/effect/atom";\nimport { useMemo } from "react";\nexport function Cart() { const atoms = createActorAtoms(runtime, cartMachine); return useAtomValue(atoms.state); }\nconsole.log(useMemo);\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts module-scope XState v6 systems, setups and actor atoms", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useMachine, useSelector } from "@xstate/react";\nimport { createActorAtoms } from "@xstate/effect/atom";\nimport { createSystem } from "xstate";\nconst system = createSystem({ registry: {} });\nconst cartMachine = system.setup().createMachine({});\nconst actor = system.createActor(cartMachine).start();\nconst atoms = createActorAtoms(runtime, cartMachine);\nexport function Cart() { const [snapshot] = useMachine(cartMachine); return [snapshot.value, useSelector(actor, (s) => s.value), atoms]; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores createActor members on objects that are not XState v6 systems", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useMachine } from "@xstate/react";\nconst registry = makeRegistry();\nexport function Cart() { const record = registry.createActor("cart"); return [record.id, useMachine]; }\n',
    ),
  ).resolves.toBeUndefined();
});
