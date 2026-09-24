import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleFixes, assertRuleReports } from "../test-support.js";

const ruleName = "cloudflare/mysql2-disable-eval";

it("reports createConnection options without disableEval in a Worker", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import { createConnection } from "mysql2/promise";\nexport default {\n  async fetch(request: Request, env: Env) {\n    const connection = await createConnection({ host: env.HYPERDRIVE.host, port: env.HYPERDRIVE.port });\n    return Response.json(await connection.query("SELECT 1"));\n  },\n};\n',
      { message: /Add `disableEval: true`/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports disableEval set to anything but literal true", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'import mysql from "mysql2/promise";\nexport const open = (env: Env) => mysql.createPool({ host: env.HYPERDRIVE.host, disableEval: false });\n',
      { message: /must be the literal `true`/ },
    ),
  ).resolves.toBeUndefined();
});

it("adds disableEval after the last property, keeping a trailing comma valid", async () => {
  await expect(
    assertRuleFixes(
      ruleName,
      'import { createConnection } from "mysql2/promise";\nexport const open = (env: Env) =>\n  createConnection({\n    host: env.HYPERDRIVE.host,\n    user: env.HYPERDRIVE.user,\n  });\n',
      'import { createConnection } from "mysql2/promise";\nexport const open = (env: Env) =>\n  createConnection({\n    host: env.HYPERDRIVE.host,\n    user: env.HYPERDRIVE.user, disableEval: true,\n  });\n',
    ),
  ).resolves.toBeUndefined();
});

it("replaces an empty options object in a Worker module", async () => {
  await expect(
    assertRuleFixes(
      ruleName,
      'import { createPool } from "mysql2";\nimport { env } from "cloudflare:workers";\nexport const pool = () => createPool({});\n',
      'import { createPool } from "mysql2";\nimport { env } from "cloudflare:workers";\nexport const pool = () => createPool({ disableEval: true });\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts disableEval: true and leaves spreads and non-literal options alone", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createConnection } from "mysql2/promise";\nexport default {\n  async fetch(request: Request, env: Env) {\n    const base = { host: env.HYPERDRIVE.host };\n    await createConnection({ ...base, port: 3306 });\n    await createConnection(base);\n    await createConnection({ host: env.HYPERDRIVE.host, disableEval: true });\n    return new Response("ok");\n  },\n};\n',
    ),
  ).resolves.toBeUndefined();
});

it("ignores mysql2 in Node code that does not read a Worker env", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { createPool } from "mysql2/promise";\nexport const pool = createPool({ host: process.env.DB_HOST });\n',
    ),
  ).resolves.toBeUndefined();
});
