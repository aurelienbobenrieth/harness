/**
 * Require every foreign-key column of a Drizzle `pgTable` to lead an index,
 * unique constraint, or primary key; Postgres never indexes the referencing side.
 *
 * @attribution https://www.postgresql.org/docs/current/ddl-constraints.html (inspiration; independently implemented)
 * @attribution planetscale/database-skills skills/postgres/references/schema-design.md by PlanetScale (MIT, concept)
 */
import {
  binding,
  importedNameFrom,
  isFunctionNode,
  memberPropertyName,
  propertyKeyName,
  unwrapExpression,
} from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree, Rule } from "@oxlint/plugins";

const message =
  "Postgres does not index foreign-key columns, so joins on this column and deletes of the referenced row scan the whole table. Add an index, unique constraint, or primary key that starts with this column in the table's extra config, e.g. `(t) => [index().on(t.column)]`.";

const pgCore: readonly string[] = ["drizzle-orm/pg-core"];

/** Extra-config builders whose first column gets a usable btree prefix. */
const coveringBuilders: ReadonlySet<string> = new Set(["index", "uniqueIndex", "unique", "primaryKey"]);

/** Column-level modifiers that create an index on the column itself. */
const coveringModifiers: ReadonlySet<string> = new Set(["primaryKey", "unique"]);

type ForeignKey = { readonly column: string; readonly node: ESTree.Node };

function isTableCall(context: Context, node: ESTree.CallExpression): boolean {
  const callee = unwrapExpression(node.callee);
  if (importedNameFrom(context, callee, pgCore) === "pgTable") return true;
  // `const app = pgSchema("app"); app.table(...)`
  if (callee.type !== "MemberExpression" || memberPropertyName(callee) !== "table") return false;
  const owner = unwrapExpression(callee.object);
  if (owner.type !== "Identifier") return false;
  return (binding(context, owner, owner.name)?.defs ?? []).some((definition) => {
    if (definition.node.type !== "VariableDeclarator") return false;
    const initial = definition.node.init;
    return initial?.type === "CallExpression" && importedNameFrom(context, initial.callee, pgCore) === "pgSchema";
  });
}

/** Object returned by a columns argument: a literal, or `(t) => ({ ... })`. */
function returnedObject(node: ESTree.Node | undefined): ESTree.ObjectExpression | undefined {
  if (node === undefined) return undefined;
  const value = unwrapExpression(node);
  if (value.type === "ObjectExpression") return value;
  if (value.type !== "ArrowFunctionExpression" || value.body.type === "BlockStatement") return undefined;
  const body = unwrapExpression(value.body);
  return body.type === "ObjectExpression" ? body : undefined;
}

/** Method names called along a builder chain such as `integer().notNull().references(...)`, outermost first. */
function chainCalls(node: ESTree.Node): { readonly name: string; readonly call: ESTree.CallExpression }[] {
  const calls: { name: string; call: ESTree.CallExpression }[] = [];
  let current = unwrapExpression(node);
  while (current.type === "CallExpression") {
    const callee = unwrapExpression(current.callee);
    const name = memberPropertyName(callee);
    if (name === undefined || callee.type !== "MemberExpression") break;
    calls.push({ name, call: current });
    current = unwrapExpression(callee.object);
  }
  return calls;
}

/** Root call of a builder chain: `index("x")` in `index("x").on(t.a).where(...)`. */
function chainRoot(node: ESTree.Node): ESTree.CallExpression | undefined {
  let current = unwrapExpression(node);
  for (;;) {
    if (current.type !== "CallExpression") return undefined;
    const callee = unwrapExpression(current.callee);
    if (callee.type !== "MemberExpression") return current;
    current = unwrapExpression(callee.object);
  }
}

/** Column key of `t.column` (also through `.asc()` / `.desc()` / `.op(...)` / `.nullsFirst()` wrappers). */
function columnKey(node: ESTree.Node | undefined, tableParam: string): string | undefined {
  if (node === undefined || node.type === "SpreadElement") return undefined;
  let current = unwrapExpression(node);
  while (current.type === "CallExpression") {
    const callee = unwrapExpression(current.callee);
    if (callee.type !== "MemberExpression") return undefined;
    current = unwrapExpression(callee.object);
  }
  if (current.type !== "MemberExpression") return undefined;
  const owner = unwrapExpression(current.object);
  return owner.type === "Identifier" && owner.name === tableParam ? memberPropertyName(current) : undefined;
}

function firstArrayColumn(node: ESTree.Node | undefined, tableParam: string): string | undefined {
  if (node === undefined) return undefined;
  const value = unwrapExpression(node);
  if (value.type !== "ObjectExpression") return columnKey(value, tableParam);
  const columns = value.properties.find(
    (property) => property.type === "Property" && propertyKeyName(property) === "columns",
  );
  if (columns?.type !== "Property") return undefined;
  const list = unwrapExpression(columns.value);
  return list.type === "ArrayExpression" ? columnKey(list.elements[0] ?? undefined, tableParam) : undefined;
}

/** First column a covering builder indexes, or the first column of a `foreignKey(...)`. */
function builderFirstColumn(entry: ESTree.Node, tableParam: string): string | undefined {
  const calls = chainCalls(entry);
  const on = calls.find((call) => call.name === "on");
  if (on !== undefined) return columnKey(on.call.arguments[0], tableParam);
  const using = calls.find((call) => call.name === "using");
  if (using !== undefined) return columnKey(using.call.arguments[1], tableParam);
  const root = chainRoot(entry);
  return root === undefined ? undefined : firstArrayColumn(root.arguments[0], tableParam);
}

type ExtraConfig = { readonly covered: Set<string>; readonly foreignKeys: ForeignKey[] };

/**
 * Read the third `pgTable` argument. Returns `undefined` when it is present but
 * not statically readable, so the table is skipped rather than guessed.
 */
function readExtraConfig(context: Context, node: ESTree.Node | undefined): ExtraConfig | undefined {
  const result: ExtraConfig = { covered: new Set(), foreignKeys: [] };
  if (node === undefined) return result;
  const fn = unwrapExpression(node);
  if (!isFunctionNode(fn) || fn.type !== "ArrowFunctionExpression" || fn.body === null) return undefined;
  const param = fn.params[0];
  if (param?.type !== "Identifier") return undefined;
  if (fn.body.type === "BlockStatement") return undefined;
  const body = unwrapExpression(fn.body);
  let entries: ESTree.Node[];
  if (body.type === "ArrayExpression") {
    if (body.elements.some((element) => element === null || element.type === "SpreadElement")) return undefined;
    entries = body.elements as ESTree.Node[];
  } else if (body.type === "ObjectExpression") {
    if (body.properties.some((property) => property.type !== "Property")) return undefined;
    entries = body.properties.map((property) => (property as ESTree.ObjectProperty).value);
  } else {
    return undefined;
  }
  for (const entry of entries) {
    const root = chainRoot(entry);
    const builder = root === undefined ? undefined : importedNameFrom(context, root.callee, pgCore);
    if (builder === undefined) continue;
    const column = builderFirstColumn(entry, param.name);
    if (column === undefined) continue;
    if (coveringBuilders.has(builder)) result.covered.add(column);
    else if (builder === "foreignKey") result.foreignKeys.push({ column, node: entry });
  }
  return result;
}

export const fkColumnIndexed: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require each foreign-key column of a Drizzle pgTable (.references() or foreignKey()) to be the first column of an index, unique constraint, or primary key.",
    },
    messages: {
      unindexedForeignKey: message,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTableCall(context, node)) return;
        const columns = returnedObject(node.arguments[1]);
        if (columns === undefined) return;
        const extra = readExtraConfig(context, node.arguments[2]);
        if (extra === undefined) return;
        const covered = new Set(extra.covered);
        const foreignKeys: ForeignKey[] = [...extra.foreignKeys];
        for (const property of columns.properties) {
          if (property.type !== "Property") continue;
          const key = propertyKeyName(property);
          if (key === undefined) continue;
          const calls = chainCalls(property.value);
          if (calls.some((call) => coveringModifiers.has(call.name))) covered.add(key);
          const reference = calls.find((call) => call.name === "references");
          if (reference !== undefined) foreignKeys.push({ column: key, node: reference.call });
        }
        for (const foreignKey of foreignKeys) {
          if (covered.has(foreignKey.column)) continue;
          context.report({ node: foreignKey.node, messageId: "unindexedForeignKey" });
        }
      },
    };
  },
};
