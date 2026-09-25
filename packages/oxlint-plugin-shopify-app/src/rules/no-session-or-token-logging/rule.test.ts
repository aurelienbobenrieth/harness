import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "shopify-app/no-session-or-token-logging";

it.each([
  ["a session object", 'console.log("session", session);\n'],
  ["a shorthand session property", "logger.info({ session });\n"],
  ["an access token member", "console.debug(`token ${session.accessToken}`);\n"],
  ["a serialised session", "this.logger.warn(JSON.stringify(session));\n"],
  ["a snake_case token", "log.info({ token: response.access_token });\n"],
])("reports %s", async (_label, code) => {
  await expect(assertRuleReports(ruleName, code)).resolves.toBeUndefined();
});

it("reports the payload destructured from authenticate.webhook", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `export const action = async ({ request }) => {
  const { topic, payload } = await authenticate.webhook(request);
  console.log(topic, payload);
  return new Response();
};
`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts non-sensitive session members, unrelated payloads and non-logger calls", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export const action = async ({ request }, payload) => {
  const { topic, session } = await authenticate.webhook(request);
  console.log(\`Received \${topic} for \${session.shop}\`);
  console.log("payload", payload, session?.id);
  logger.info({ shop: session.shop, accessTokenPresent: Boolean(token) });
  store.save(session);
  return new Response();
};
`,
    ),
  ).resolves.toBeUndefined();
});

it("honours configured logger objects and sensitive names", async () => {
  await expect(
    assertRuleReports(ruleName, "audit.write({ apiSecret });\n", {
      ruleOptions: { loggerObjects: ["audit"], sensitiveNames: ["apiSecret"] },
    }),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(ruleName, "console.log(session);\n", {
      ruleOptions: { sensitiveNames: ["apiSecret"] },
    }),
  ).resolves.toBeUndefined();
});
