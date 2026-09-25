/**
 * Flags `vars` entries that look like credentials, at the top level and in every environment. `vars` are
 * committed in plain text and shown in the dashboard; secrets belong in `secrets.required` and are set with
 * `wrangler secret put`. Two independent signals: a secret-shaped name, or a value matching a well-known
 * credential format. Values are never echoed in findings.
 *
 * @attribution https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/workers/configuration/secrets/ (inspiration; independently implemented)
 */
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { isRecord, loadWranglerConfigs } from "../wrangler-config.js";

const id = "no-secrets-in-vars";
const docs = "https://developers.cloudflare.com/workers/configuration/secrets/";

const secretWords = new Set([
  "secret",
  "secrets",
  "token",
  "tokens",
  "password",
  "passwd",
  "pwd",
  "passphrase",
  "credential",
  "credentials",
  "apikey",
  "privatekey",
]);
const secretPairs = new Set(["api key", "private key", "access key", "signing key", "encryption key", "auth key"]);
/** A trailing word that makes the name describe the secret rather than hold it, e.g. TOKEN_URL. */
const descriptorWords = new Set([
  "url",
  "uri",
  "endpoint",
  "host",
  "path",
  "header",
  "name",
  "ttl",
  "expiry",
  "length",
  "type",
  "issuer",
  "audience",
  "scope",
  "scopes",
]);

const valueFormats: readonly (readonly [RegExp, string])[] = [
  [/^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+$/u, "a JSON Web Token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/u, "a PEM private key"],
  [/\b[sr]k_(?:live|test)_[A-Za-z\d]{10,}/u, "a Stripe secret key"],
  [/\b(?:gh[pousr]_[A-Za-z\d]{30,}|github_pat_\w{30,})/u, "a GitHub token"],
  [/\bglpat-[\w-]{20,}/u, "a GitLab token"],
  [/\bxox[abprs]-[\w-]{10,}/u, "a Slack token"],
  [/\bAKIA[\dA-Z]{16}\b/u, "an AWS access key"],
  [/\bsk-(?:proj-|ant-)?[\w-]{20,}/u, "an API secret key"],
];

function nameWords(name: string): readonly string[] {
  return name
    .replaceAll(/([a-z\d])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z\d]+/u)
    .filter((word) => word !== "");
}

function secretName(name: string): boolean {
  const words = nameWords(name);
  if (words.length === 0 || descriptorWords.has(words.at(-1) ?? "")) return false;
  return words.some((word, index) => secretWords.has(word) || secretPairs.has(`${word} ${words[index + 1] ?? ""}`));
}

function credentialUrl(value: string): boolean {
  if (!value.includes("://")) return false;
  try {
    return new URL(value).password !== "";
  } catch {
    return false;
  }
}

function stringLeaves(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringLeaves);
  if (isRecord(value)) return Object.values(value).flatMap(stringLeaves);
  return [];
}

function valueReason(value: unknown): string | undefined {
  for (const leaf of stringLeaves(value)) {
    if (credentialUrl(leaf)) return "its value is a URL with an embedded password";
    const format = valueFormats.find(([pattern]) => pattern.test(leaf));
    if (format !== undefined) return `its value looks like ${format[1]}`;
  }
  return undefined;
}

export const noSecretsInVars: ConformanceCheck = {
  id,
  description: "vars at the top level and in every environment hold no secret-named keys or credential-shaped values.",
  docs,
  async run(options) {
    const allowed = new Set(options.allowedVars ?? []);
    const { configs, findings } = await loadWranglerConfigs(options, id, docs);
    const results: ConformanceFinding[] = [...findings];
    for (const config of configs) {
      for (const target of [{ label: "top level", own: config.top }, ...config.environments]) {
        const vars = target.own["vars"];
        if (vars === undefined) continue;
        if (!isRecord(vars)) {
          results.push({
            check: id,
            docs,
            path: config.path,
            severity: "error",
            evaluation: "failed",
            message: `${target.label}: vars must be an object of name/value pairs. Fix its shape.`,
          });
          continue;
        }
        for (const [name, value] of Object.entries(vars)) {
          const reason =
            valueReason(value) ?? (secretName(name) && !allowed.has(name) ? "its name marks a secret" : undefined);
          if (reason === undefined) continue;
          results.push({
            check: id,
            docs,
            path: config.path,
            severity: "error",
            message: `${target.label}: vars.${name} looks like a secret (${reason}). vars are committed in plain text: remove it, list it in secrets.required, and set it with \`wrangler secret put ${name}\`.`,
          });
        }
      }
    }
    return results;
  },
};
