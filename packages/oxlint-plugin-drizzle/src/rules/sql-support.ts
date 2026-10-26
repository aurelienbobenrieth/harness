import { importedNameFrom } from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree } from "@oxlint/plugins";

/** Only complete, static Drizzle SQL templates; dynamic SQL needs review at its execution boundary. */
export function staticSql(context: Context, node: ESTree.TaggedTemplateExpression): string | undefined {
  if (importedNameFrom(context, node.tag, ["drizzle-orm"]) !== "sql" || node.quasi.expressions.length) return undefined;
  return node.quasi.quasis.map((part) => part.value.cooked ?? part.value.raw).join("");
}
