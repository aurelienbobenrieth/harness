/** Resolves a dotted translation key to an owned string property; inherited or non-string values do not count. */
export function hasTranslation(locale: Record<string, unknown>, dottedKey: string): boolean {
  let current: unknown = locale;
  for (const segment of dottedKey.split(".")) {
    if (typeof current !== "object" || current === null) return false;
    if (!Object.hasOwn(current, segment)) return false;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string";
}

/** Parses a locale file; anything but a JSON object is `undefined`. */
export function parseLocale(content: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
