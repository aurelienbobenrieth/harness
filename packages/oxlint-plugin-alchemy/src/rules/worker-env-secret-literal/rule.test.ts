import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const ruleName = "alchemy/worker-env-secret-literal";
const header = [
  'import * as Cloudflare from "alchemy/Cloudflare";',
  'import * as Config from "effect/Config";',
  'import * as Redacted from "effect/Redacted";',
  "",
].join("\n");

it("reports a string literal bound to a secret-named env key", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export const Worker = Cloudflare.Worker("Worker", {
  main: "./src/worker.ts",
  env: { STRIPE_SECRET: "sk_live_123" },
});
`,
      { message: /env.STRIPE_SECRET looks like a secret but is a plain string/ },
    ),
  ).resolves.toBeUndefined();
});

it("reports templates, process.env reads and fallbacks in class and Tag.make forms", async () => {
  const messages = await reportedMessages(
    ruleName,
    `import { Worker } from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export class Api extends Worker<Api>()(
  "Api",
  {
    main: import.meta.url,
    env: {
      "SENTRY_DSN": \`https://\${process.env.SENTRY_KEY}@sentry.io/1\`,
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://localhost",
    },
  },
  Effect.gen(function* () { return {}; }),
) {}

export class Jobs extends Worker<Jobs, {}>()("Jobs") {}
export const JobsLive = Jobs.make(
  { main: import.meta.url, env: { GITHUB_TOKEN: process.env["GITHUB_TOKEN"] } },
  Effect.gen(function* () { return {}; }),
);
`,
  );
  expect(messages.map((text) => /env\.(\w+)/.exec(text)?.[1])).toEqual(["SENTRY_DSN", "DATABASE_URL", "GITHUB_TOKEN"]);
});

it("accepts Config, Redacted, non-secret keys, public keys and empty placeholders", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}declare const Bucket: unknown;
export const Worker = Cloudflare.Worker("Worker", {
  main: "./src/worker.ts",
  env: {
    API_KEY: Config.Redacted("API_KEY"),
    HOST_TOKEN: Config.String("HOST_TOKEN"),
    WEBHOOK_SECRET: Redacted.make("whsec"),
    STRIPE_PUBLISHABLE_KEY: "pk_live_123",
    SESSION_TOKEN_TTL: "3600",
    ENVIRONMENT: "production",
    PASSWORD: "",
    Bucket,
  },
});
`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores env on other runtimes and on look-alike calls, and honours a custom secret pattern", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${header}import * as AWS from "alchemy/AWS";
declare function Worker(id: string, props: object): unknown;
export const Fn = AWS.Lambda.Function("Fn", { main: "./fn.ts", env: { API_TOKEN: "abc" } });
export const Local = Worker("Local", { env: { API_TOKEN: "abc" } });
export const Real = Cloudflare.Worker("Real", { main: "./src/worker.ts", env: { API_TOKEN: "abc" } });
`,
      { ruleOptions: { secretPattern: "^INTERNAL_" } },
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(
      ruleName,
      `${header}export const Real = Cloudflare.Worker("Real", { main: "./src/worker.ts", env: { INTERNAL_SIGNER: "abc" } });\n`,
      { ruleOptions: { secretPattern: "^INTERNAL_" } },
    ),
  ).resolves.toBeUndefined();
});
