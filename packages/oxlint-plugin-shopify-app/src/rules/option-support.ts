export function firstOption(context: unknown): Record<string, unknown> {
  const options = (context as { readonly options?: readonly unknown[] }).options;
  const first = options?.[0];
  if (typeof first !== "object" || first === null) return {};
  return first as Record<string, unknown>;
}

export function stringArrayOption(
  option: Record<string, unknown>,
  key: string,
  fallback: readonly string[],
): readonly string[] {
  const value = option[key];
  if (!Array.isArray(value)) return fallback;
  const strings = value.filter((entry): entry is string => typeof entry === "string");
  return strings.length > 0 ? strings : fallback;
}
