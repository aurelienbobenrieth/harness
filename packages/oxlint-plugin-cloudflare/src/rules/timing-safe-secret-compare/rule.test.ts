import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "cloudflare/timing-safe-secret-compare";

it("reports a bearer token compared with !== against env", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export default {\n  async fetch(request: Request, env: Env) {\n    if (request.headers.get("authorization") !== `Bearer ${env.API_TOKEN}`) return new Response("no", { status: 401 });\n    return new Response("ok");\n  },\n};\n',
    ),
  ).resolves.toBeUndefined();
});

it("reports comparisons through this.env and a Hono context", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "export class Api {\n  env = { WEBHOOK_SECRET: '' };\n  check(signature: string) { return this.env.WEBHOOK_SECRET === signature; }\n}\n",
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      'export const guard = (c: { env: { ADMIN_PASSWORD: string }; req: { header(n: string): string } }) => c.req.header("x-pass") == c.env.ADMIN_PASSWORD;\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts presence checks and non-secret env values", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'export function check(env: Env, mode: string) {\n  if (env.API_TOKEN === undefined || env.API_TOKEN === "" || env.SESSION_SECRET == null) throw new Error("missing");\n  return env.ENVIRONMENT === mode;\n}\n',
    ),
  ).resolves.toBeUndefined();
});

it("accepts timingSafeEqual and Node process.env comparisons", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "export function check(env: Env, given: string) {\n  const encoder = new TextEncoder();\n  const a = encoder.encode(given);\n  const b = encoder.encode(env.API_TOKEN);\n  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b) && process.env.NODE_TOKEN !== given;\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("stays silent for secret-named env values that describe a secret instead of holding one", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'export default {\n  fetch(request: Request, env: Env) {\n    if (env.tokenKind === "project") return new Response("a");\n    if (env.TOKEN_TYPE === "bearer") return new Response("b");\n    if (env.AUTH_TOKEN_HEADER === "x-token") return new Response("c");\n    return new Response("d");\n  },\n};\n',
    ),
  ).resolves.toBeUndefined();
});

it("still reports a secret whose name merely contains a descriptor word", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      'export default { fetch(request: Request, env: Env) { return new Response(String(request.headers.get("x") === env.HOSTED_API_KEY)); } };\n',
      { message: /timingSafeEqual/ },
    ),
  ).resolves.toBeUndefined();
});
