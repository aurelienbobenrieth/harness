import { expect, it } from "vitest";
import { fixCode } from "../sota-test-support.ts";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/no-swallowed-failure";

it("reports bare Effect.ignore in a pipe and as a direct call", async () => {
  await expect(assertRuleReports(ruleName, "const warm = warmCache.pipe(Effect.ignore);\n")).resolves.toBeUndefined();
  await expect(assertRuleReports(ruleName, "const warm = Effect.ignore(warmCache);\n")).resolves.toBeUndefined();
});

it("reports Effect.catch handlers that discard the error for a placeholder", async () => {
  await expect(
    assertRuleReports(ruleName, "const a = load.pipe(Effect.catch(() => Effect.void));\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const b = load.pipe(Effect.catch((_error) => Effect.succeed(null)));\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const c = Effect.catch(load, () => { return Effect.succeed([]); });\n"),
  ).resolves.toBeUndefined();
});

it("reports Effect.orElseSucceed fallbacks that replace every error with a placeholder", async () => {
  await expect(
    assertRuleReports(ruleName, "const a = load.pipe(Effect.orElseSucceed(() => null));\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const b = Effect.orElseSucceed(load, () => []);\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const c = load.pipe(Effect.orElseSucceed(() => {}));\n"),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, "const d = load.pipe(Effect.orElseSucceed(() => { return undefined; }));\n"),
  ).resolves.toBeUndefined();
});

it("allows Effect.orElseSucceed with a computed fallback", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        "const a = load.pipe(Effect.orElseSucceed(() => cachedUser));",
        "const b = Effect.orElseSucceed(load, () => defaultSettings(tenant));",
        "const c = load.pipe(Effect.orElseSucceed(() => { audit(); return null; }));",
        "const d = Other.orElseSucceed(() => null);",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows logged ignores", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const a = warmCache.pipe(Effect.ignore({ log: "Warn", message: "cache warmup failed" }));',
        "const b = Effect.ignore(warmCache, { log: true });",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows handlers that use the error, compute a real fallback, or name the condition", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const a = load.pipe(Effect.catch((error) => Effect.logWarning("load failed", error)));',
        "const b = load.pipe(Effect.catch(() => loadFromReplica));",
        "const c = load.pipe(Effect.catch(() => Effect.succeed(cachedUser)));",
        'const d = load.pipe(Effect.catchTag("NotFound", () => Effect.succeed(null)));',
        "const e = Other.catch(() => Effect.void);",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows bare ignore inside finalizers by default and reports it when disabled", async () => {
  const code =
    "const resource = Effect.acquireRelease(open, (handle) => handle.close.pipe(Effect.ignore));\nconst fin = Effect.addFinalizer(() => flush.pipe(Effect.ignore));\n";
  await expect(assertRuleDoesNotReport(ruleName, code)).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, code, { ruleConfig: ["error", { allowInFinalizers: false }] }),
  ).resolves.toBeUndefined();
});

it("still reports ignore in the acquire position", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "const resource = Effect.acquireRelease(open.pipe(Effect.ignore), () => Effect.void);\n",
    ),
  ).resolves.toBeUndefined();
});

it("suggests the log option", async () => {
  await expect(fixCode(ruleName, "const warm = warmCache.pipe(Effect.ignore);\n", "suggestions")).resolves.toBe(
    "const warm = warmCache.pipe(Effect.ignore({ log: true }));\n",
  );
  await expect(fixCode(ruleName, "const warm = Effect.ignore(warmCache);\n", "suggestions")).resolves.toBe(
    "const warm = Effect.ignore(warmCache, { log: true });\n",
  );
});
