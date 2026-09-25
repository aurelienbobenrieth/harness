import { binding, importedSpecifierName } from "@aurelienbbn/oxlint-kit/ast";
import type { Context, ESTree } from "@oxlint/plugins";

/**
 * Packages whose exports count as TanStack Query APIs: the core and every
 * official framework adapter (`@tanstack/react-query`, `@tanstack/vue-query`,
 * `@tanstack/solid-query`, `@tanstack/svelte-query`, `@tanstack/preact-query`,
 * `@tanstack/angular-query-experimental`, `@tanstack/query-core`).
 */
const queryPackagePattern = /^@tanstack\/(?:query-core|[a-z]+-query(?:-experimental)?)$/;

function isQueryPackage(source: unknown): boolean {
  return typeof source === "string" && queryPackagePattern.test(source);
}

/**
 * Return the exported TanStack Query name an expression refers to, following
 * import aliases (`import { useQuery as useQ }`) and namespace imports
 * (`import * as rq`; `rq.useQuery`). Anything not imported from a TanStack
 * Query package, including a local shadow of the same name, yields `undefined`.
 */
export function importedQueryName(context: Context, node: ESTree.Node): string | undefined {
  return importedSpecifierName(context, node, isQueryPackage);
}

/**
 * True when the file imports anything from a TanStack Query package. Rules that
 * match on option names such as `queryFn` or `select` use this gate so that an
 * unrelated object with the same property name is never inspected.
 */
export function fileImportsQuery(context: Context): boolean {
  return context.sourceCode.ast.body.some(
    (statement) => statement.type === "ImportDeclaration" && isQueryPackage(statement.source.value),
  );
}

/** True when the identifier resolves to no local binding, i.e. it is the ambient global. */
export function isUnshadowedGlobal(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  const variable = binding(context, node, node.name);
  return variable === undefined || variable.defs.length === 0;
}
