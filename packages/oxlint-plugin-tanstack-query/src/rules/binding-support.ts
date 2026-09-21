import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

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

/** Resolve a name through the lexical scope chain, so local shadows win over imports. */
export function binding(context: Context, node: ESTree.Node, name: string): Variable | undefined {
  let scope: Scope | null = context.sourceCode.getScope(node);
  while (scope !== null) {
    const variable = scope.set.get(name);
    if (variable !== undefined) return variable;
    scope = scope.upper;
  }
  return undefined;
}

/**
 * Return the exported TanStack Query name an expression refers to, following
 * import aliases (`import { useQuery as useQ }`) and namespace imports
 * (`import * as rq`; `rq.useQuery`). Anything not imported from a TanStack
 * Query package, including a local shadow of the same name, yields `undefined`.
 */
export function importedQueryName(context: Context, node: ESTree.Node): string | undefined {
  if (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.property.type === "Identifier"
  ) {
    const namespace = (binding(context, node.object, node.object.name)?.defs ?? []).some(
      (definition) =>
        definition.node.type === "ImportNamespaceSpecifier" &&
        definition.parent?.type === "ImportDeclaration" &&
        isQueryPackage(definition.parent.source.value),
    );
    return namespace ? node.property.name : undefined;
  }
  if (node.type !== "Identifier") return undefined;
  for (const definition of binding(context, node, node.name)?.defs ?? []) {
    if (
      definition.node.type !== "ImportSpecifier" ||
      definition.parent?.type !== "ImportDeclaration" ||
      !isQueryPackage(definition.parent.source.value)
    )
      continue;
    const imported = definition.node.imported;
    return imported.type === "Identifier" ? imported.name : String(imported.value);
  }
  return undefined;
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
