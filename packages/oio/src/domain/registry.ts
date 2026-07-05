import { Schema } from "effect";
import { defaultStatuses } from "../config.js";

export const RegistryEntry = Schema.Struct({
  id: Schema.String,
  name: Schema.optional(Schema.String),
  status: Schema.String,
  surface: Schema.optional(Schema.Literals(["merchant", "internal", "preset", "contract"])),
  delivery: Schema.optional(Schema.Literals(["block", "compound", "snippet", "section", "enhancer", "adapter"])),
  path: Schema.optional(Schema.String),
  via: Schema.optional(Schema.String),
});

export type RegistryEntry = Schema.Schema.Type<typeof RegistryEntry>;
export type RegistrySurface = NonNullable<RegistryEntry["surface"]>;
export type RegistryDelivery = NonNullable<RegistryEntry["delivery"]>;

export type MarkdownEntry = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
};

const idPattern = /^[a-z][\w-]*(\.[\w-]+)+$/;

/** Parse every `| id | name | status |` row out of the registry markdown. */
export function parseMarkdownRegistry(
  markdown: string,
  statuses: readonly string[] = defaultStatuses,
): readonly MarkdownEntry[] {
  const statusSet = new Set(statuses);
  const entries: MarkdownEntry[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    // split("|") yields a leading and trailing empty cell for well-formed rows
    if (cells.length < 5) continue;
    const [, id, name, status] = cells;
    if (id === undefined || name === undefined || status === undefined) continue;
    if (!idPattern.test(id) || !statusSet.has(status)) continue;
    entries.push({ id, name, status });
  }
  return entries;
}

export type RegistryDrift = {
  readonly duplicateIds: readonly string[];
  readonly missingInJson: readonly string[];
  readonly extraInJson: readonly string[];
  readonly statusMismatches: readonly { readonly id: string; readonly markdown: string; readonly json: string }[];
};

export function diffRegistries(
  markdownEntries: readonly MarkdownEntry[],
  jsonEntries: readonly RegistryEntry[],
): RegistryDrift {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  for (const entry of markdownEntries) {
    if (seen.has(entry.id)) duplicateIds.push(entry.id);
    seen.add(entry.id);
  }

  const jsonById = new Map(jsonEntries.map((entry) => [entry.id, entry]));
  const markdownIds = new Set(markdownEntries.map((entry) => entry.id));

  const missingInJson = [...markdownIds].filter((id) => !jsonById.has(id));
  const extraInJson = jsonEntries.map((entry) => entry.id).filter((id) => !markdownIds.has(id));
  const statusMismatches = markdownEntries
    .filter((entry) => {
      const jsonEntry = jsonById.get(entry.id);
      return jsonEntry !== undefined && jsonEntry.status !== entry.status;
    })
    .map((entry) => ({ id: entry.id, markdown: entry.status, json: jsonById.get(entry.id)?.status ?? "" }));

  return { duplicateIds, missingInJson, extraInJson, statusMismatches };
}

export type SyncSummary = {
  readonly added: readonly string[];
  readonly updated: readonly string[];
  readonly removed: readonly string[];
};

/** Markdown owns the id set and statuses; JSON keeps its classification fields. */
export function mergeRegistries(
  markdownEntries: readonly MarkdownEntry[],
  jsonEntries: readonly RegistryEntry[],
): { readonly primitives: readonly RegistryEntry[]; readonly summary: SyncSummary } {
  const jsonById = new Map(jsonEntries.map((entry) => [entry.id, entry]));
  const markdownIds = new Set(markdownEntries.map((entry) => entry.id));

  const added: string[] = [];
  const updated: string[] = [];
  const primitives: RegistryEntry[] = [];
  const mergedIds = new Set<string>();

  for (const entry of markdownEntries) {
    if (mergedIds.has(entry.id)) continue;
    mergedIds.add(entry.id);
    const existing = jsonById.get(entry.id);
    if (existing === undefined) {
      added.push(entry.id);
      primitives.push({ id: entry.id, name: entry.name, status: entry.status });
      continue;
    }
    if (existing.status !== entry.status || existing.name !== entry.name) updated.push(entry.id);
    primitives.push({ ...existing, name: entry.name, status: entry.status });
  }

  const removed = jsonEntries.map((entry) => entry.id).filter((id) => !markdownIds.has(id));
  return { primitives, summary: { added, updated, removed } };
}

export function serializeRegistry(primitives: readonly RegistryEntry[]): string {
  return `${JSON.stringify({ primitives }, null, 2)}\n`;
}

export function parseJsonRegistry(content: string): readonly RegistryEntry[] | undefined {
  try {
    const parsed = JSON.parse(content) as { readonly primitives?: unknown };
    if (Array.isArray(parsed)) return parsed as readonly RegistryEntry[];
    return Array.isArray(parsed.primitives) ? (parsed.primitives as readonly RegistryEntry[]) : undefined;
  } catch {
    return undefined;
  }
}
