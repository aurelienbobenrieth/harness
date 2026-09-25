import { describe, expect, it } from "vitest";
import { noSecretsInVars } from "./no-secrets-in-vars.js";
import { createFixture, wrangler } from "./test-support.js";

async function run(config: Record<string, unknown>, allowedVars?: readonly string[]) {
  const root = await createFixture({ "wrangler.jsonc": wrangler(config) });
  return noSecretsInVars.run({ root, ...(allowedVars ? { allowedVars } : {}) });
}

function flagged(findings: readonly { readonly message: string }[]): readonly string[] {
  return findings.map((finding) => /vars\.(\S+) /u.exec(finding.message)?.[1] ?? "?");
}

describe("no-secrets-in-vars", () => {
  it("passes plain configuration, including names that only describe a secret", async () => {
    expect(
      await run({
        vars: {
          API_HOST: "https://api.example.com",
          TOKEN_URL: "https://auth.example.com/token",
          SECRET_NAME: "stripe",
          PUBLIC_KEY_ID: "k1",
          FEATURES: { beta: true, label: "Tokenizer" },
          KEYBOARD_LAYOUT: "azerty",
        },
      }),
    ).toEqual([]);
  });

  it("fails secret-shaped names in snake, kebab and camel case", async () => {
    const findings = await run({
      vars: { STRIPE_SECRET: "x", apiKey: "x", "db-password": "x", GITHUB_TOKEN: "", AWS_ACCESS_KEY_ID: "x" },
    });
    expect(flagged(findings)).toEqual(["STRIPE_SECRET", "apiKey", "db-password", "GITHUB_TOKEN", "AWS_ACCESS_KEY_ID"]);
    expect(findings[0]?.severity).toBe("error");
  });

  it("fails credential-shaped values under innocent names, nested values included, without echoing them", async () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";
    const findings = await run({
      vars: {
        DATABASE_URL: "postgres://app:hunter2@db.example.com/app",
        SESSION: jwt,
        PAYMENTS: { key: "sk_live_0123456789abcdef" },
        GH: `ghp_${"a".repeat(36)}`,
      },
    });
    expect(flagged(findings)).toEqual(["DATABASE_URL", "SESSION", "PAYMENTS", "GH"]);
    expect(findings.some((finding) => finding.message.includes("hunter2") || finding.message.includes(jwt))).toBe(
      false,
    );
  });

  it("checks every environment's vars", async () => {
    const findings = await run({ vars: {}, env: { staging: { vars: { SIGNING_KEY: "x" } } } });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("env.staging: vars.SIGNING_KEY");
  });

  it("exempts reviewed names but still scans their values", async () => {
    expect(await run({ vars: { CSRF_TOKEN_HEADER_VALUE: "x-csrf" } }, ["CSRF_TOKEN_HEADER_VALUE"])).toEqual([]);
    expect(await run({ vars: { MY_TOKEN: "postgres://u:p@h/db" } }, ["MY_TOKEN"])).toHaveLength(1);
  });

  it("reports malformed vars as unevaluated", async () => {
    const findings = await run({ vars: ["API_KEY"] });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evaluation).toBe("failed");
  });
});
