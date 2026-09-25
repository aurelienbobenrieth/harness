import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "cloudflare/no-interpolated-sql";

it("reports a template literal with a runtime value passed to D1 prepare", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "export default {\n  async fetch(request: Request, env: Env) {\n    const id = new URL(request.url).searchParams.get('id');\n    return Response.json(await env.DB.prepare(`SELECT * FROM users WHERE id = ${id}`).first());\n  },\n};\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports concatenation into D1 exec through a local alias and a Hono context", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export async function drop(env: Env, table: string) {\n  const db = env.DB;\n  await db.exec("DROP TABLE " + table);\n}\n',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "export const handler = async (c: { env: Env; req: { param(n: string): string } }) => c.env.DB.prepare(`DELETE FROM t WHERE id = ${c.req.param('id')}`).run();\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports Durable Object sql.exec with an interpolated query held in a const", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "import { DurableObject } from \"cloudflare:workers\";\nexport class Room extends DurableObject {\n  post(user: string) {\n    const query = `INSERT INTO messages (user) VALUES ('${user}')`;\n    this.ctx.storage.sql.exec(query);\n  }\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("accepts placeholders with bind() and exec bindings", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { DurableObject } from "cloudflare:workers";\nexport class Room extends DurableObject {\n  post(user: string, env: Env) {\n    this.ctx.storage.sql.exec("INSERT INTO messages (user) VALUES (?)", user);\n    return env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user).first();\n  }\n}\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts interpolation of author-time constants", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'const TABLE = "users";\nconst COLUMNS = "id, " + "name";\nexport const read = (env: Env) => env.DB.prepare(`SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ?`).bind(1).all();\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts tagged sql templates and prepare() on unrelated receivers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "declare const sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown;\ndeclare const statement: { prepare(text: string): void };\nexport function run(id: string) {\n  sql`SELECT * FROM users WHERE id = ${id}`;\n  statement.prepare(`step ${id}`);\n}\n",
    ),
  ).resolves.toBeUndefined();
});
