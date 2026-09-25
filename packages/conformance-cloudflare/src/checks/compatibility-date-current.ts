/**
 * Keeps `compatibility_date` real and recent, and keeps the Node.js compatibility flags consistent with it.
 * Since 2026-08-04 the date alone enables Node.js compatibility, so the flag is required only before that
 * date and redundant from it on. The check never bumps the date: a bump changes runtime behavior.
 *
 * @attribution https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/workers/configuration/compatibility-dates/ (inspiration; independently implemented)
 * @attribution https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/ (inspiration; independently implemented)
 */
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { nodeCompatibility, parseCompatibilityDate } from "../compatibility.js";
import { inherited, loadWranglerConfigs, overridingEnvironments } from "../wrangler-config.js";

const id = "compatibility-date-current";
const docs = "https://developers.cloudflare.com/workers/configuration/compatibility-dates/";
const defaultMaxAgeDays = 180;
const dayMs = 86_400_000;

function utcDay(value: Date | string | undefined): number {
  const date = value === undefined ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`now must be a valid date: ${String(value)}`);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export const compatibilityDateCurrent: ConformanceCheck = {
  id,
  description:
    "compatibility_date is set, not in the future, within the configured age, and consistent with the nodejs_compat flag.",
  docs,
  async run(options) {
    const maxAgeDays = options.compatibilityDateMaxAgeDays ?? defaultMaxAgeDays;
    if (!Number.isInteger(maxAgeDays) || maxAgeDays <= 0)
      throw new Error(`compatibilityDateMaxAgeDays must be a positive integer: ${maxAgeDays}`);
    const today = utcDay(options.now);
    const { configs, findings } = await loadWranglerConfigs(options, id, docs);
    const results: ConformanceFinding[] = [...findings];
    for (const config of configs) {
      const report = (label: string, severity: ConformanceFinding["severity"], message: string): void => {
        results.push({ check: id, docs, path: config.path, severity, message: `${label}: ${message}` });
      };
      const targets = [
        { label: "top level", own: config.top },
        ...overridingEnvironments(config, ["compatibility_date", "compatibility_flags"]),
      ];
      for (const target of targets) {
        const rawDate = inherited(config, target, "compatibility_date");
        const date = parseCompatibilityDate(rawDate);
        if (date === undefined) {
          report(
            target.label,
            "error",
            rawDate === undefined
              ? "compatibility_date is missing, so the runtime falls back to 2021-11-02 semantics. Set it to today's date."
              : `compatibility_date ${JSON.stringify(rawDate)} is not a real YYYY-MM-DD date. Set it to today's date.`,
          );
          continue;
        }
        if (date.time > today)
          report(
            target.label,
            "error",
            `compatibility_date ${date.text} is in the future. Set it to today or earlier.`,
          );
        else if ((today - date.time) / dayMs > maxAgeDays)
          report(
            target.label,
            "error",
            `compatibility_date ${date.text} is older than ${maxAgeDays} days. Move it forward after reviewing the compatibility flags changelog.`,
          );
        const compat = nodeCompatibility(date, inherited(config, target, "compatibility_flags"));
        if (compat === "malformed-flags")
          report(target.label, "error", "compatibility_flags must be an array of strings. Fix its shape.");
        else if (compat === "missing-flag")
          report(
            target.label,
            "error",
            `compatibility_date ${date.text} predates 2026-08-04 and nodejs_compat is not set. Add "nodejs_compat" to compatibility_flags or move the date to 2026-08-04 or later.`,
          );
        else if (compat === "redundant-flag")
          report(
            target.label,
            "warning",
            `nodejs_compat is redundant from compatibility_date 2026-08-04 on. Remove it from compatibility_flags.`,
          );
      }
    }
    return results;
  },
};
