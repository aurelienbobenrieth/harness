import type { Context, ESTree } from "@oxlint/plugins";
import { type FunctionNode, parentOf } from "@aurelienbbn/oxlint-kit/ast";
import { propertyName, resolveFunction } from "./ast.js";
import { fileImportsQuery } from "./binding-support.js";

/**
 * Return the function behind a `queryFn` / `mutationFn` option, in files that
 * import a TanStack Query package. The option is recognized wherever it sits:
 * hook calls, `queryOptions`, `useQueries` entries, client methods and option
 * factories all share the same property names.
 */
export function queryFunction(
  context: Context,
  property: ESTree.Node,
  names: ReadonlySet<string>,
): FunctionNode | undefined {
  if (property.type !== "Property" || property.kind !== "init") return undefined;
  const name = propertyName(property);
  if (name === undefined || !names.has(name)) return undefined;
  if (parentOf(property)?.type !== "ObjectExpression") return undefined;
  if (!fileImportsQuery(context)) return undefined;
  return resolveFunction(context, property.value);
}

export const queryAndMutationFunctionNames: ReadonlySet<string> = new Set(["queryFn", "mutationFn"]);
export const queryFunctionNames: ReadonlySet<string> = new Set(["queryFn"]);
