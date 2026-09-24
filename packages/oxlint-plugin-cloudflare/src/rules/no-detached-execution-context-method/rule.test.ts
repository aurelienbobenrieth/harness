import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "cloudflare/no-detached-execution-context-method";

it("reports waitUntil destructured from ctx", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "export default {\n  async fetch(request: Request, env: Env, ctx: ExecutionContext) {\n    const { waitUntil } = ctx;\n    waitUntil(fetch('https://example.com/log'));\n    return new Response('ok');\n  },\n};\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports destructuring in the handler parameter list", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "export default {\n  async fetch(request: Request, env: Env, { passThroughOnException }: ExecutionContext) {\n    passThroughOnException();\n    return new Response('ok');\n  },\n};\n",
    ),
  ).resolves.toBeUndefined();
});

it("reports the method passed as a callback or stored", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      "export default {\n  async fetch(request: Request, env: Env, ctx: ExecutionContext) {\n    [fetch('https://a.example')].forEach(ctx.waitUntil);\n    return new Response('ok');\n  },\n};\n",
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      "export function later(ctx: ExecutionContext) {\n  const defer = ctx.waitUntil;\n  return { defer };\n}\n",
    ),
  ).resolves.toBeUndefined();
});

it("accepts direct, optional, bound, and called-through calls", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      "export default {\n  async fetch(request: Request, env: Env, ctx: ExecutionContext) {\n    ctx.waitUntil(fetch('https://a.example'));\n    ctx.waitUntil?.(Promise.resolve());\n    const defer = ctx.waitUntil.bind(ctx);\n    ctx.passThroughOnException.call(ctx);\n    if (ctx.waitUntil) defer(Promise.resolve());\n    const { props } = ctx as ExecutionContext & { props: unknown };\n    return Response.json(props);\n  },\n};\n",
    ),
  ).resolves.toBeUndefined();
});

it("accepts the standalone waitUntil export of cloudflare:workers", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { waitUntil } from "cloudflare:workers";\nexport async function log() {\n  const { waitUntil: later } = await import("cloudflare:workers");\n  waitUntil(fetch("https://a.example"));\n  later(Promise.resolve());\n}\n',
    ),
  ).resolves.toBeUndefined();
});
