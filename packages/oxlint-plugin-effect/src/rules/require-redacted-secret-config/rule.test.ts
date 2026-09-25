import { expect, it } from "vitest";
import { fixCode } from "../test-support.ts";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.ts";

const ruleName = "effect/require-redacted-secret-config";

it("reports secrets read as plain strings", async () => {
  await expect(
    assertRuleReports(ruleName, 'const key = Config.String("STRIPE_SECRET_KEY");\n'),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleReports(ruleName, 'const config = Config.all({ url: Config.NonEmptyString("DATABASE_URL") });\n'),
  ).resolves.toBeUndefined();
  await expect(assertRuleReports(ruleName, 'const dsn = Config.String("SENTRY_DSN");\n')).resolves.toBeUndefined();
});

it("allows redacted secrets and ordinary keys", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const key = Config.Redacted("STRIPE_SECRET_KEY");',
        'const host = Config.String("SMTP_HOST");',
        'const ttl = Config.Int("TOKEN_TTL");',
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
});

it("allows secret-looking names that describe metadata, dynamic names and other Config objects", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      [
        'const header = Config.String("API_KEY_HEADER_NAME");',
        'const min = Config.String("PASSWORD_MIN_LENGTH");',
        "const dynamic = Config.String(secretName);",
        "",
      ].join("\n"),
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      'import { Config } from "./my-config";\nconst mine = Config.String("API_TOKEN");\n',
    ),
  ).resolves.toBeUndefined();
});

it("honours a custom secret pattern", async () => {
  await expect(
    assertRuleReports(ruleName, 'const pepper = Config.String("HASH_PEPPER");\n', {
      ruleOptions: { secretPattern: "PEPPER" },
    }),
  ).resolves.toBeUndefined();
});

it("suggests Config.Redacted", async () => {
  await expect(fixCode(ruleName, 'const key = Config.String("API_TOKEN");\n', "suggestions")).resolves.toBe(
    'const key = Config.Redacted("API_TOKEN");\n',
  );
});
