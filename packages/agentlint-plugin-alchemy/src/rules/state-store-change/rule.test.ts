import { testRuleOnChange } from "@aurelienbbn/agentlint/testing";
import type { ChangeFixture } from "@aurelienbbn/agentlint";
import { expect, it } from "vitest";
import { stateStoreChange } from "./rule.js";

async function messages(fixture: ChangeFixture): Promise<string[]> {
  const findings = await testRuleOnChange({ rule: stateStoreChange, fixture });
  return findings.map((finding) => finding.message);
}

const stack = (name: string, options: string): string =>
  `export default Alchemy.Stack("${name}", ${options}, Effect.gen(function* () {}));\n`;

it("reports a switched state store for human review", async () => {
  const findings = await testRuleOnChange({
    rule: stateStoreChange,
    fixture: {
      before: { "alchemy.run.ts": stack("App", "{ providers: Cloudflare.providers(), state: localState() }") },
      after: { "alchemy.run.ts": stack("App", "{ providers: Cloudflare.providers(), state: Cloudflare.state() }") },
    },
  });
  expect(findings.map((finding) => [finding.authority, finding.lineageKey])).toEqual([["human", "state-store:App"]]);
  expect(findings[0]?.message).toContain("(localState() → Cloudflare.state())");
});

it("reports an added state option and a store switched alongside a stack rename", async () => {
  expect(
    await messages({
      before: { "alchemy.run.ts": stack("App", "{ providers }") },
      after: { "alchemy.run.ts": stack("App", "{ providers, state: localState() }") },
    }),
  ).toHaveLength(1);
  expect(
    await messages({
      before: { "alchemy.run.ts": stack("App", "{ providers, state: localState() }") },
      after: { "alchemy.run.ts": stack("Api", '{ providers, state: postgresState({ url: Config.Redacted("URL") }) }') },
    }),
  ).toHaveLength(1);
});

it("stays silent for formatting, new stacks and test harness stores", async () => {
  expect(
    await messages({
      before: { "alchemy.run.ts": stack("App", "{ providers, state: Cloudflare.state({ workerName: 'store' }) }") },
      after: {
        "alchemy.run.ts": stack(
          "App",
          '{\n  providers,\n  state: Cloudflare.state({\n    workerName: "store",\n  }),\n}',
        ),
      },
    }),
  ).toEqual([]);
  expect(await messages({ before: {}, after: { "alchemy.run.ts": stack("App", "{ state: localState() }") } })).toEqual(
    [],
  );
  expect(
    await messages({
      before: { "stack.ts": "const { deploy } = Test.make({ providers, state: localState() });\n" },
      after: { "stack.ts": "const { deploy } = Test.make({ providers, state: AWS.state() });\n" },
    }),
  ).toEqual([]);
});

const file = (store: string): string =>
  `const state = ${store};\nexport default Alchemy.Stack("App", { providers, state }, program);\n`;

it("resolves a shorthand or identifier state option to its same-file const initializer", async () => {
  expect(
    await messages({
      before: { "alchemy.run.ts": file("localState()") },
      after: { "alchemy.run.ts": file("Cloudflare.state()") },
    }),
  ).toEqual([expect.stringContaining("(localState() → Cloudflare.state())")]);
  expect(
    await messages({
      before: { "alchemy.run.ts": file("localState()") },
      after: { "alchemy.run.ts": `const other = 1;\n${file("localState()")}` },
    }),
  ).toEqual([]);
});
