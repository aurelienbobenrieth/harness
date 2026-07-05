const schemaPattern = /{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/;
const docPattern = /{%-?\s*doc\s*-?%}([\s\S]*?){%-?\s*enddoc\s*-?%}/;

export type SchemaSetting = {
  readonly id?: string;
  readonly type?: string;
  readonly label?: string;
  readonly visible_if?: string;
};

export type SchemaPreset = {
  readonly name?: string;
  readonly settings?: Record<string, unknown>;
};

export type LiquidSchema = {
  readonly name?: string;
  readonly settings?: readonly SchemaSetting[];
  readonly presets?: readonly SchemaPreset[];
};

export function hasSchemaTag(content: string): boolean {
  return schemaPattern.test(content);
}

export function hasDocTag(content: string): boolean {
  return docPattern.test(content);
}

export function docText(content: string): string | undefined {
  return docPattern.exec(content)?.[1];
}

export function parseSchema(content: string): LiquidSchema | undefined {
  const match = schemaPattern.exec(content);
  if (match?.[1] === undefined) return undefined;
  return parseJson<LiquidSchema>(match[1]);
}

export function parseJson<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

export function schemaSettingIds(schema: LiquidSchema): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const setting of schema.settings ?? []) {
    if (typeof setting.id === "string") ids.add(setting.id);
  }
  return ids;
}

/** Collect every `t:` translation key used inside a schema JSON payload. */
export function collectTranslationKeys(value: unknown, keys: Set<string>): void {
  if (typeof value === "string") {
    if (value.startsWith("t:")) keys.add(value.slice(2));
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectTranslationKeys(entry, keys);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const entry of Object.values(value)) collectTranslationKeys(entry, keys);
  }
}

/** Resolve a dotted translation key against a nested locale object. */
export function localeKeyExists(locale: unknown, dottedKey: string): boolean {
  let current: unknown = locale;
  for (const segment of dottedKey.split(".")) {
    if (typeof current !== "object" || current === null) return false;
    current = (current as Record<string, unknown>)[segment];
  }
  return current !== undefined;
}

/** Flatten a nested locale object into dotted keys. */
export function flattenLocaleKeys(locale: unknown, prefix = ""): readonly string[] {
  if (typeof locale !== "object" || locale === null) return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(locale)) {
    const dotted = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "object" && value !== null) {
      keys.push(...flattenLocaleKeys(value, dotted));
    } else {
      keys.push(dotted);
    }
  }
  return keys;
}
