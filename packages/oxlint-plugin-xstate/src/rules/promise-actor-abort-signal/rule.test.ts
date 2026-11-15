import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "xstate/promise-actor-abort-signal";

it("reports fetch without the actor signal", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { fromPromise } from "xstate";\nexport const load = fromPromise(async ({ input }: any) => { const res = await fetch(`/api/${input.id}`); return res.json(); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports an explicit GET without signal", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { fromPromise } from "xstate";\nexport const load = fromPromise(({ input }: any) => fetch(input.url, { method: "GET" }));\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts fetch forwarding the signal", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { fromPromise } from "xstate";\nexport const load = fromPromise(async ({ input, signal }: any) => { const res = await fetch(input.url, { signal }); return res.json(); });\n',
    ),
  ).resolves.toBeUndefined();
});

it("leaves mutations alone", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { fromPromise } from "xstate";\nexport const save = fromPromise(({ input }: any) => fetch(input.url, { method: "POST", body: input.body }));\n',
    ),
  ).resolves.toBeUndefined();
});

it("leaves dynamic request options alone", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { fromPromise } from "xstate";\nexport const load = fromPromise(({ input }: any) => fetch(input.url, input.init));\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores a locally defined fetch and wrapped clients", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { fromPromise } from "xstate";\nimport { fetch } from "./client.js";\nexport const load = fromPromise(({ input }: any) => fetch(input.url));\nexport const other = fromPromise(({ input }: any) => api.get(input.url));\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores fromPromise from another module", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { fromPromise } from "./actors.js";\nexport const load = fromPromise(({ input }: any) => fetch(input.url));\n',
    ),
  ).resolves.toBeUndefined();
});

it("skips referenced logic functions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { fromPromise } from "xstate";\nexport const load = fromPromise(loadCart);\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports fetch without the signal in an XState v6 createAsyncLogic run", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createAsyncLogic } from "xstate";\nexport const load = createAsyncLogic({ run: async ({ input }: { input: { url: string } }) => { const res = await fetch(input.url); return res.json(); } });\n',
      { message: /Async actor logic aborts its signal when the actor stops/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports fetch without the signal in a createAsyncLogic run method", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createAsyncLogic } from "xstate";\nexport const load = createAsyncLogic({ async run() { return (await fetch("/cart")).json(); } });\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports fetch without the signal in an XState v6 createInvoke src", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { setup } from "xstate";\nconst s = setup({ actors: {} });\nexport const m = s.createMachine({ invoke: s.createInvoke({ src: async () => (await fetch("/cart")).json() }) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts XState v6 async logic forwarding the signal", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createAsyncLogic, setup } from "xstate";\nexport const load = createAsyncLogic({ run: async ({ input, signal }: { input: { url: string }; signal: AbortSignal }) => (await fetch(input.url, { signal })).json() });\nconst s = setup({ actors: {} });\nexport const m = s.createMachine({ invoke: s.createInvoke({ src: async ({ signal }) => (await fetch("/cart", { signal })).json() }) });\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores createInvoke on objects that are not setup results and referenced run functions", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createAsyncLogic } from "xstate";\nexport const load = createAsyncLogic({ run: loadCart });\nexport const job = queue.createInvoke({ src: async () => fetch("/cart") });\n',
    ),
  ).resolves.toBeUndefined();
});
