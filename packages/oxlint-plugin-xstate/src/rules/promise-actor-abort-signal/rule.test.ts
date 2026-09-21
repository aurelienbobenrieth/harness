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
