import { expect, it } from "vitest";
import { fixCode } from "../test-support.ts";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/require-abort-signal";

it("reports a fetch thunk that ignores the signal parameter", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const res = Effect.tryPromise({ try: () => fetch(url), catch: (cause) => new HttpError({ cause }) });\n",
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "const res = Effect.promise(async () => { const r = await fetch(url); return r.json(); });\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports configured abortable calls", async () => {
  await expect(
    assertRuleReports(ruleName, "const res = Effect.tryPromise(() => axios.get(url));\n", {
      ruleOptions: { abortableCalls: ["fetch", "axios.get"] },
    }),
  ).resolves.toBeUndefined();
});

it("allows thunks that forward a signal", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = Effect.tryPromise({ try: (signal) => fetch(url, { signal }), catch: (cause) => new HttpError({ cause }) });",
        "const b = Effect.tryPromise(() => fetch(url, { signal: controller.signal }));",
        "const c = Effect.tryPromise(() => fetch(url, { ...init }));",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("ignores thunks without abortable calls, shadowed fetch and non-Effect wrappers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = Effect.tryPromise(() => db.query(sql));",
        "const b = (fetch: (u: string) => Promise<string>) => Effect.tryPromise(() => fetch(url));",
        "const c = Other.tryPromise(() => fetch(url));",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("suggests forwarding the signal", async () => {
  await expect(fixCode(ruleName, "const a = Effect.tryPromise(() => fetch(url));\n", "suggestions")).resolves.toBe(
    "const a = Effect.tryPromise((signal) => fetch(url, { signal }));\n",
  );
  await expect(
    fixCode(ruleName, 'const a = Effect.tryPromise(() => fetch(url, { method: "POST" }));\n', "suggestions"),
  ).resolves.toBe('const a = Effect.tryPromise((signal) => fetch(url, { signal, method: "POST" }));\n');
});
