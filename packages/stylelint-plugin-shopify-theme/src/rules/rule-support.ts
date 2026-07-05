export function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[\\w-]*");
  return new RegExp(`^${escaped}$`);
}

export function matchesAnyPattern(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => wildcardToRegExp(pattern).test(value));
}

export function stringArrayOption(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === "string");
}

/** Split a declaration value on top-level whitespace and commas, keeping function calls intact. */
export function splitValueParts(value: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth === 0 && (character === " " || character === "\t" || character === "\n" || character === ",")) {
      if (current.length > 0) parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}
