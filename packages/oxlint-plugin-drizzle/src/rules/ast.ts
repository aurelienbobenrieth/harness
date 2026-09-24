import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

type ParentNode = ESTree.Node & {
  readonly parent?: ParentNode | null;
};

export type FunctionNode = ParentNode & {
  readonly type: "ArrowFunctionExpression" | "FunctionDeclaration" | "FunctionExpression";
  readonly params: readonly ESTree.Node[];
  readonly body: ESTree.Node | null;
  readonly async?: boolean;
};

export function isFunctionNode(node: ESTree.Node | null | undefined): node is FunctionNode {
  return (
    node?.type === "ArrowFunctionExpression" ||
    node?.type === "FunctionDeclaration" ||
    node?.type === "FunctionExpression"
  );
}

/** Strip TypeScript-only wrappers and parentheses that do not change the runtime value. */
export function unwrapExpression(node: ESTree.Node): ESTree.Node {
  let current = node;
  for (;;) {
    if (
      current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "ParenthesizedExpression" ||
      current.type === "ChainExpression"
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

function stringLiteralValue(node: ESTree.Node | null | undefined): string | undefined {
  if (node === null || node === undefined) return undefined;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/** Static key of a non-computed property, whether written as an identifier or a string literal. */
export function propertyKeyName(node: ESTree.Node): string | undefined {
  if ((node.type !== "Property" && node.type !== "MethodDefinition") || node.computed) return undefined;
  if (node.key.type === "Identifier") return node.key.name;
  return stringLiteralValue(node.key);
}

export function memberPropertyName(node: ESTree.Node): string | undefined {
  if (node.type !== "MemberExpression" || node.computed || node.property.type !== "Identifier") return undefined;
  return node.property.name;
}

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
 * Resolve an identifier (named, default, or namespace member) to the name it is
 * exported under when it is imported from one of the module sources. Default
 * imports resolve to `"default"`.
 */
export function importedNameFrom(context: Context, node: ESTree.Node, sources: readonly string[]): string | undefined {
  const target = unwrapExpression(node);
  if (target.type === "MemberExpression" && !target.computed && target.object.type === "Identifier") {
    const name = memberPropertyName(target);
    const owner = importDefinition(context, target.object, sources);
    const namespaceLike =
      owner?.node.type === "ImportNamespaceSpecifier" || owner?.node.type === "ImportDefaultSpecifier";
    return namespaceLike ? name : undefined;
  }
  if (target.type !== "Identifier") return undefined;
  const definition = importDefinition(context, target, sources);
  if (definition === undefined) return undefined;
  if (definition.node.type === "ImportDefaultSpecifier") return "default";
  if (definition.node.type !== "ImportSpecifier") return undefined;
  const imported = definition.node.imported;
  return imported.type === "Identifier" ? imported.name : String(imported.value);
}

function importDefinition(context: Context, node: ESTree.Node, sources: readonly string[]) {
  if (node.type !== "Identifier") return undefined;
  return (binding(context, node, node.name)?.defs ?? []).find(
    (definition) =>
      definition.parent?.type === "ImportDeclaration" && sources.includes(String(definition.parent.source.value)),
  );
}
