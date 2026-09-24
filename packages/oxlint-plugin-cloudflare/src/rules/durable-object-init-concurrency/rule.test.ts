import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "cloudflare/durable-object-init-concurrency";
const header = 'import { DurableObject } from "cloudflare:workers";\n';
const unguarded = /starts in the Durable Object constructor without blocking input/;
const network = /Network I\/O inside blockConcurrencyWhile/;

it("reports a storage read in the constructor outside blockConcurrencyWhile", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export class Counter extends DurableObject {\n  value = 0;\n  constructor(ctx: DurableObjectState, env: Env) {\n    super(ctx, env);\n    void ctx.storage.get<number>("value").then((v) => { this.value = v ?? 0; });\n  }\n}\n`,
      { message: unguarded },
    ),
  ).resolves.toBeUndefined();
});

it("reports an async IIFE and an async method call in the constructor", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export class Counter extends DurableObject {\n  constructor(ctx: DurableObjectState, env: Env) {\n    super(ctx, env);\n    void (async () => { await fetch("https://config.example"); })();\n  }\n}\n`,
      { message: unguarded },
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export class Counter extends DurableObject {\n  constructor(ctx: DurableObjectState, env: Env) {\n    super(ctx, env);\n    void this.load();\n  }\n  async load() {}\n}\n`,
      { message: unguarded },
    ),
  ).resolves.toBeUndefined();
});

it("reports fetch and binding I/O inside blockConcurrencyWhile", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export class Counter extends DurableObject<Env> {\n  constructor(ctx: DurableObjectState, env: Env) {\n    super(ctx, env);\n    void ctx.blockConcurrencyWhile(async () => {\n      await fetch("https://config.example");\n    });\n  }\n}\n`,
      { message: network },
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export class Counter extends DurableObject<Env> {\n  async refresh() {\n    await this.ctx.blockConcurrencyWhile(async () => {\n      const flags = await this.env.FLAGS.get("flags");\n      await this.ctx.storage.put("flags", flags);\n    });\n  }\n}\n`,
      { message: network },
    ),
  ).resolves.toBeUndefined();
});

it("accepts storage reads and synchronous SQL inside blockConcurrencyWhile", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export class Counter extends DurableObject {\n  value = 0;\n  constructor(ctx: DurableObjectState, env: Env) {\n    super(ctx, env);\n    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS t (id INTEGER)");\n    const cached = ctx.storage.kv.get("value");\n    void ctx.blockConcurrencyWhile(async () => {\n      this.value = (await ctx.storage.get<number>("value")) ?? Number(cached ?? 0);\n    });\n  }\n}\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts deferred callbacks in the constructor and classes that are not Durable Objects", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}export class Counter extends DurableObject {\n  constructor(ctx: DurableObjectState, env: Env) {\n    super(ctx, env);\n    this.onMessage = async () => { await ctx.storage.get("value"); };\n  }\n  onMessage: () => Promise<void>;\n}\nexport class Cache {\n  constructor(private storage: { get(key: string): Promise<unknown> }) {\n    void storage.get("warm");\n  }\n}\n`,
    ),
  ).resolves.toBeUndefined();
});
