import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "cloudflare/no-module-scope-request-state";
const client = /database client built at module scope/;
const state = /writes to a module-scope binding/;

it("reports a pg Client built at module scope in a Worker", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { Client } from "pg";\nimport { env } from "cloudflare:workers";\nconst client = new Client({ connectionString: env.HYPERDRIVE.connectionString });\nexport default { async fetch() { return new Response(String(await client.query("select 1"))); } };\n',
      { message: client },
    ),
  ).resolves.toBeUndefined();
});

it("reports a module-scope Drizzle postgres-js client and a postgres() call", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { drizzle } from "drizzle-orm/postgres-js";\nimport { env } from "cloudflare:workers";\nexport const db = drizzle(env.HYPERDRIVE.connectionString);\n',
      { message: client },
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'import postgres from "postgres";\nconst sql = postgres("postgres://localhost/db");\nexport default { fetch: async (request: Request, env: Env) => new Response(String(await sql`select 1`)) };\n',
      { message: client },
    ),
  ).resolves.toBeUndefined();
});

it("reports a mysql2 pool created through a namespace-like default import", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import mysql from "mysql2/promise";\nconst pool = mysql.createPool({ host: "db", disableEval: true });\nexport default { async fetch(request: Request, env: Env) { await pool.query("select 1"); return new Response("ok"); } };\n',
      { message: client },
    ),
  ).resolves.toBeUndefined();
});

it("reports a lazily cached client assigned to a module-scope let", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { Client } from "pg";\nlet client: Client | undefined;\nexport default {\n  async fetch(request: Request, env: Env) {\n    client ??= new Client(env.HYPERDRIVE.connectionString);\n    return new Response("ok");\n  },\n};\n',
      { message: state },
    ),
  ).resolves.toBeUndefined();
});

it("reports request data stored on or pushed into a module-scope object", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'const seen: string[] = [];\nconst current = { user: "" };\nexport default {\n  async fetch(request: Request, env: Env) {\n    seen.push(request.url);\n    current.user = request.headers.get("x-user") ?? "";\n    return new Response("ok");\n  },\n};\n',
      { message: state },
    ),
  ).resolves.toBeUndefined();
});

it("accepts clients created inside the handler and handler-local state", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Client } from "pg";\nconst LIMIT = 10;\nexport default {\n  async fetch(request: Request, env: Env) {\n    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });\n    await client.connect();\n    const seen: string[] = [];\n    seen.push(request.url);\n    return new Response(String(LIMIT + seen.length));\n  },\n};\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts instance fields on Durable Objects and a module-scope Drizzle D1 client", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { DurableObject } from "cloudflare:workers";\nimport { drizzle } from "drizzle-orm/d1";\nimport { Pool } from "pg";\nconst db = drizzle({} as D1Database);\nexport class Counter extends DurableObject {\n  pool = new Pool();\n  count = 0;\n  async fetch() { this.count++; return new Response(String(this.count)); }\n}\nconsole.log(db);\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores module-scope clients and writes in files that are not Workers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Pool } from "pg";\nexport const pool = new Pool();\nlet calls = 0;\nexport function count() { calls += 1; return calls; }\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports a Worker whose handler object has a queue handler or passes fetch by reference", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { Pool } from "pg";\nconst pool = new Pool();\nexport default { queue: async (batch) => { await pool.query("select 1"); } };\n',
      { message: client },
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'import { Pool } from "pg";\nimport { app } from "./app";\nconst pool = new Pool();\nexport default { fetch: app.fetch };\n',
      { message: client },
    ),
  ).resolves.toBeUndefined();
});

it("stays silent for Bun, Deno and Neon style default exports that are not Worker handlers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Pool } from "pg";\nconst pool = new Pool();\nlet hits = 0;\nexport default { port: 3000, fetch(req: Request, server: unknown) { hits++; return new Response(String(hits)); } };\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Pool } from "pg";\nconst pool = new Pool({ connectionString: process.env.DATABASE_URL });\nexport default { async fetch(request: Request) { return Response.json(await pool.query("select 1")); } };\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "let seen = 0;\nexport default { test: { onConsoleLog() { seen++; return false; } } };\n",
    ),
  ).resolves.toBeUndefined();
});

it("stays silent for a WeakMap keyed by the request env", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'const perEnv = new WeakMap<object, string>();\nexport default { async fetch(request: Request, env: Env) { perEnv.set(env, "x"); return new Response("ok"); } };\n',
    ),
  ).resolves.toBeUndefined();
});
