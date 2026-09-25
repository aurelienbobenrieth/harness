import {
  Kind,
  parse,
  visit,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from "graphql";
import type { ESTree } from "@oxlint/plugins";

const parseCacheLimit = 256;
const parseCache = new Map<string, DocumentNode | null>();

/**
 * Parse once per distinct source text. Several rules inspect the same literal, and oxlint loads
 * every rule of this plugin from one module graph, so the cache is shared across them.
 */
function parseDocument(text: string): DocumentNode | null {
  const cached = parseCache.get(text);
  if (cached !== undefined) return cached;
  let document: DocumentNode | null;
  try {
    document = parse(text);
  } catch {
    document = null;
  }
  if (parseCache.size >= parseCacheLimit) parseCache.clear();
  parseCache.set(text, document);
  return document;
}

/** Top-level mutation fields plus the fragments defined beside them. */
export type MutationDocument = {
  readonly fields: readonly FieldNode[];
  readonly fragments: ReadonlyMap<string, FragmentDefinitionNode>;
};

const emptyMutationDocument: MutationDocument = { fields: [], fragments: new Map() };

/** Inspect actual mutation fields; prose and response selections are not writes. */
export function mutationDocument(text: string): MutationDocument {
  if (!/\bmutation\b/.test(text)) return emptyMutationDocument;
  const document = parseDocument(text);
  if (document === null) return emptyMutationDocument;
  const fields: FieldNode[] = [];
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) fragments.set(definition.name.value, definition);
    if (definition.kind !== Kind.OPERATION_DEFINITION || definition.operation !== "mutation") continue;
    for (const selection of definition.selectionSet.selections) {
      if (selection.kind === Kind.FIELD) fields.push(selection);
    }
  }
  return { fields, fragments };
}

export function mutationFields(text: string): readonly FieldNode[] {
  return mutationDocument(text).fields;
}

export function hasInputField(field: FieldNode, name: string): boolean {
  return (field.arguments ?? []).some((argument) => {
    let found = false;
    visit(argument.value, {
      ObjectField(node) {
        if (node.name.value === name) found = true;
      },
    });
    return found;
  });
}

/** Direct selection names of a field, following inline fragments and same-document fragment spreads. */
export type SelectionNames = {
  readonly names: ReadonlySet<string>;
  /** A spread targets a fragment defined elsewhere, so the selection cannot be fully known. */
  readonly unresolved: boolean;
};

export function selectionNames(
  field: FieldNode,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
): SelectionNames {
  const names = new Set<string>();
  const seen = new Set<string>();
  let unresolved = false;
  const collect = (selectionSet: SelectionSetNode | undefined): void => {
    for (const selection of selectionSet?.selections ?? []) {
      if (selection.kind === Kind.FIELD) names.add(selection.name.value);
      else if (selection.kind === Kind.INLINE_FRAGMENT) collect(selection.selectionSet);
      else {
        const fragment = fragments.get(selection.name.value);
        if (fragment === undefined) unresolved = true;
        else if (!seen.has(fragment.name.value)) {
          seen.add(fragment.name.value);
          collect(fragment.selectionSet);
        }
      }
    }
  };
  collect(field.selectionSet);
  return { names, unresolved };
}

/** GraphQL candidate text of a string or template literal, with the offsets where `${}` holes were removed. */
export type GraphqlSource = { readonly text: string; readonly holes: readonly number[] };

export function graphqlSource(node: ESTree.Node): GraphqlSource | undefined {
  if (node.type === "Literal") return typeof node.value === "string" ? { text: node.value, holes: [] } : undefined;
  if (node.type !== "TemplateLiteral") return undefined;
  let text = "";
  const holes: number[] = [];
  node.quasis.forEach((quasi, index) => {
    text += quasi.value.raw;
    if (index < node.quasis.length - 1) holes.push(text.length);
  });
  return { text, holes };
}

/** An interpolation inside the field makes its arguments, directives or selection unknowable. */
export function fieldHasHole(field: FieldNode, holes: readonly number[]): boolean {
  const location = field.loc;
  if (location === undefined) return holes.length > 0;
  return holes.some((hole) => hole >= location.start && hole <= location.end);
}
