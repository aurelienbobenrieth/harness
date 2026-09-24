/** First compatibility date on which Node.js compatibility is on without a flag. */
const nodeCompatDefaultDate = Date.UTC(2026, 7, 4);
const compatFlags = new Set(["nodejs_compat", "nodejs_compat_v2"]);
const optOutFlags = new Set(["no_nodejs_compat", "no_nodejs_compat_v2"]);

export type CompatibilityDate = { readonly text: string; readonly time: number };

/** Accepts only a real calendar date written as YYYY-MM-DD. */
export function parseCompatibilityDate(value: unknown): CompatibilityDate | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day)
    return undefined;
  return { text: value, time };
}

export type NodeCompatibility = "enabled" | "disabled" | "missing-flag" | "redundant-flag" | "malformed-flags";

/**
 * Classifies Node.js compatibility for one Worker. `disabled` is an explicit opt-out; `missing-flag` means
 * a pre-2026-08-04 date without the flag, which leaves it off.
 */
export function nodeCompatibility(date: CompatibilityDate, flags: unknown): NodeCompatibility {
  if (flags !== undefined && (!Array.isArray(flags) || !flags.every((flag) => typeof flag === "string")))
    return "malformed-flags";
  const list: readonly string[] = flags ?? [];
  const onByDate = date.time >= nodeCompatDefaultDate;
  if (list.some((flag) => optOutFlags.has(flag))) return "disabled";
  const flagged = list.some((flag) => compatFlags.has(flag));
  if (onByDate) return flagged ? "redundant-flag" : "enabled";
  return flagged ? "enabled" : "missing-flag";
}
