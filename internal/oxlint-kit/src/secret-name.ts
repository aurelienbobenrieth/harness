/**
 * Secret-name detection shared by the rules that judge a configuration or
 * binding key as a secret. Each rule keeps its own default patterns; the
 * option shape and the precedence (benign wins over secret) live here once.
 *
 * @module
 */

/** Default regular expressions (sources, matched case-insensitively) a rule falls back to. */
export type SecretNamePatterns = {
  readonly secretPattern: string;
  readonly benignPattern: string;
};

/** Options schema for `secretPattern` and `benignPattern`; spread into a rule's `meta.schema`. */
export const secretNameOptionsSchema = {
  type: "object",
  properties: {
    secretPattern: { type: "string" },
    benignPattern: { type: "string" },
  },
  additionalProperties: false,
} as const;

function patternOption(options: Readonly<Record<string, unknown>>, name: string, fallback: string): RegExp {
  const value = options[name];
  return new RegExp(typeof value === "string" && value.length > 0 ? value : fallback, "iu");
}

/**
 * Builds the test a rule applies to a key: it names a secret when it matches
 * `secretPattern` and not `benignPattern`. Missing or empty options fall back
 * to `defaults`.
 */
export function secretNameMatcher(
  options: Readonly<Record<string, unknown>>,
  defaults: SecretNamePatterns,
): (name: string) => boolean {
  const secret = patternOption(options, "secretPattern", defaults.secretPattern);
  const benign = patternOption(options, "benignPattern", defaults.benignPattern);

  return (name) => secret.test(name) && !benign.test(name);
}
