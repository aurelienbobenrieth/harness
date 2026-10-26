import { it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "./test-support.ts";

const rules = ["effect/prefer-effect-array-helpers", "effect/no-array-for-each", "effect/no-array-callback-reference"];
const calls = 'const rows = ["1"]; rows.map(parseInt); rows.forEach(console.log);';

for (const rule of rules) {
  it.each(["assets/vendor-esm.js", ".agents/v2/spec/viz/chart.js", "build.js", "theme.js", "src/utils.ts"])(
    `${rule} ignores non-Effect %s`,
    async (filename) => {
      await assertRuleDoesNotReport(rule, calls, { filename });
    },
  );

  it(`${rule} ignores mixed-file utilities and shadowed names`, async () => {
    await assertRuleDoesNotReport(
      rule,
      `import { Effect } from "effect"; ${calls} function utility(Effect) { return Effect.sync(() => { ${calls} }); }`,
    );
  });

  it(`${rule} reports an imported runtime callback`, async () => {
    await assertRuleReports(rule, `import * as E from "effect/Effect"; E.sync(() => { ${calls} });`);
  });

  it(`${rule} recognizes an aliased named constructor and a referenced generator`, async () => {
    await assertRuleReports(
      rule,
      `import { gen as program } from "effect/Effect"; function* body() { ${calls} } program(body);`,
    );
  });

  it(`${rule} recognizes a curried Effect.fn body`, async () => {
    await assertRuleReports(rule, `import { Effect as E } from "effect"; E.fn("task")(function* () { ${calls} });`);
  });

  it(`${rule} rejects unimported constructors beside unrelated Effect imports`, async () => {
    await assertRuleDoesNotReport(rule, `import { Option } from "effect"; Effect.gen(function* () { ${calls} });`);
    await assertRuleDoesNotReport(rule, `import type { Effect } from "effect"; Effect.sync(() => { ${calls} });`);
    await assertRuleDoesNotReport(rule, `import * as Platform from "@effect/platform"; ${calls}`);
  });

  it(`${rule} excludes deferred functions declared inside runtime bodies`, async () => {
    await assertRuleDoesNotReport(
      rule,
      `import { Effect } from "effect"; Effect.fn("task")(function* () { return { refresh: async () => { ${calls} } }; });`,
    );
  });

  it(`${rule} keeps imported module exemptions inside runtime bodies`, async () => {
    await assertRuleDoesNotReport(
      rule,
      'import { Effect, Option } from "effect"; Effect.sync(() => { Effect.forEach(ids, load); Option.filter(value, valid); });',
    );
  });
}
