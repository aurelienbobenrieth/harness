import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/stable-selector-result";

it("reports an object literal result", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { shallowEqual, useSelector } from "@xstate/react";\nexport function useView(ref: any) { return useSelector(ref, (s) => ({ items: s.context.items, total: s.context.total })); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports filter results", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { shallowEqual, useSelector } from "@xstate/react";\nexport function useView(ref: any) { return useSelector(ref, (s) => s.context.items.filter((i: any) => i.visible)); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a block body with a single return of an array", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { shallowEqual, useSelector } from "@xstate/react";\nexport function useView(ref: any) { return useSelector(ref, function (s) { return [s.context.a, s.context.b]; }); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports Object.keys results", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { shallowEqual, useSelector } from "@xstate/react";\nexport function useView(ref: any) { return useSelector(ref, (s) => Object.keys(s.context.byId)); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports the actor-context bound form", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createActorContext } from "@xstate/react";\nconst CartContext = createActorContext(cartMachine);\nexport function useView() { return CartContext.useSelector((s) => ({ total: s.context.total })); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports useSelector from @xstate/store-react", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { useSelector } from "@xstate/store-react";\nexport function useView(store: any) { return useSelector(store, (s) => s.context.items.map((i: any) => i.id)); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts selectors returning an existing reference or primitive", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { shallowEqual, useSelector } from "@xstate/react";\nexport function useView(ref: any) { const items = useSelector(ref, (s) => s.context.items); const name = useSelector(ref, (s) => s.context.name.slice(0, 3)); return [items, name, shallowEqual]; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts allocating selectors when a comparator is passed", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { shallowEqual, useSelector } from "@xstate/react";\nexport function useView(ref: any) { return useSelector(ref, (s) => ({ total: s.context.total }), shallowEqual); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts the actor-context form with a comparator", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createActorContext, shallowEqual } from "@xstate/react";\nconst CartContext = createActorContext(cartMachine);\nexport function useView() { return CartContext.useSelector((s) => ({ total: s.context.total }), shallowEqual); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("skips referenced selectors", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { shallowEqual, useSelector } from "@xstate/react";\nconst selectView = (s: any) => ({ total: s.context.total });\nexport function useView(ref: any) { return useSelector(ref, selectView); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores useSelector from other libraries", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { useSelector } from "react-redux";\nexport function useView() { return useSelector((s: any) => ({ total: s.total })); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports an allocating XState v6 actor.select without a comparator", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createActor } from "xstate";\nconst actor = createActor(cartMachine);\nexport const view = actor.select((snapshot) => ({ items: snapshot.context.items }));\n',
      { message: /never matches and every snapshot re-renders the component or notifies subscribers/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports actor.select on a system actor and on a useActorRef result", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createSystem } from "xstate";\nconst system = createSystem({ registry: {} });\nconst actor = system.createActor(cartMachine);\nexport const ids = actor.select((snapshot) => snapshot.context.items.map((item: any) => item.id));\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'import { useActorRef } from "@xstate/react";\nexport function useView() { const ref = useActorRef(cartMachine); return ref.select((snapshot) => [snapshot.context.a, snapshot.context.b]); }\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts actor.select with a comparator or a stable result", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createActor } from "xstate";\nconst actor = createActor(cartMachine);\nexport const view = actor.select((snapshot) => ({ items: snapshot.context.items }), (a, b) => a.items === b.items);\nexport const items = actor.select((snapshot) => snapshot.context.items);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores select on values that are not actor refs", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createActor } from "xstate";\nconst store = createStore();\nexport const view = store.select((state: any) => ({ items: state.items }));\nconsole.log(createActor);\n',
    ),
  ).resolves.toBeUndefined();
});
