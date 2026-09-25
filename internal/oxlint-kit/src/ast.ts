/**
 * AST helpers shared by the oxlint plugins in this repo.
 *
 * Only helpers with one agreed meaning across plugins live here; a helper whose
 * behavior is specific to one plugin stays in that plugin. Each plugin bundles
 * this module at build time, so it is never a runtime dependency of a published
 * package.
 *
 * @module
 */
import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

/** A node with the `parent` link oxlint sets on every node it visits. */
export type ParentNode = ESTree.Node & {
  readonly parent?: ParentNode | null;
};

/** Any function form that has a body: declaration, expression, or arrow. */
export type FunctionNode = ParentNode & {
  readonly type: "ArrowFunctionExpression" | "FunctionDeclaration" | "FunctionExpression";
  readonly id?: ESTree.Node | null;
  readonly params: readonly ESTree.Node[];
  readonly body: ESTree.Node | null;
  readonly async?: boolean;
  readonly generator?: boolean;
};

export function isFunctionNode(node: ESTree.Node | null | undefined): node is FunctionNode {
  return (
    node?.type === "ArrowFunctionExpression" ||
    node?.type === "FunctionDeclaration" ||
    node?.type === "FunctionExpression"
  );
}

export function parentOf(node: ESTree.Node): ParentNode | undefined {
  return (node as ParentNode).parent ?? undefined;
}

/** Closest enclosing function of `node`, excluding `node` itself. */
export function nearestFunction(node: ESTree.Node): FunctionNode | undefined {
  let current = parentOf(node);
  while (current !== undefined) {
    if (isFunctionNode(current)) return current;
    current = parentOf(current);
  }
  return undefined;
}

/**
 * Strip TypeScript-only wrappers (`as`, `satisfies`, `!`, `<T>`), parentheses,
 * and optional-chain wrappers, none of which change which value is denoted.
 */
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

/**
 * Like {@link unwrapExpression}, but stops at a `ChainExpression`: an optional
 * chain such as `(a?.b)` is returned as is instead of being unwrapped.
 */
export function unwrapExpressionKeepingChain(node: ESTree.Node): ESTree.Node {
  let current = node;
  for (;;) {
    if (
      current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "ParenthesizedExpression"
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

/** Value of a string literal or of a template literal without substitutions. */
export function stringLiteralValue(node: ESTree.Node | null | undefined): string | undefined {
  if (node === null || node === undefined) return undefined;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/**
 * Static key of a non-computed object property or class member, whether written
 * as an identifier or a string literal.
 */
export function propertyKeyName(node: ESTree.Node): string | undefined {
  if ((node.type !== "Property" && node.type !== "MethodDefinition") || node.computed) return undefined;
  if (node.key.type === "Identifier") return node.key.name;
  return stringLiteralValue(node.key);
}

/** Property name of a non-computed member access: `a.b` yields `b`; `a[b]` yields `undefined`. */
export function memberPropertyName(node: ESTree.Node): string | undefined {
  if (node.type !== "MemberExpression" || node.computed || node.property.type !== "Identifier") return undefined;
  return node.property.name;
}

function isNode(value: unknown): value is ESTree.Node {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/** Depth-first walk over a subtree; return `false` from the visitor to skip the children of a node. */
export function walk(node: ESTree.Node, visit: (node: ESTree.Node) => boolean | void): void {
  if (visit(node) === false) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      for (const entry of value) if (isNode(entry)) walk(entry, visit);
    } else if (isNode(value)) {
      walk(value, visit);
    }
  }
}

/** Resolve `name` through the lexical scope chain starting at `node`, so local shadows win over imports. */
export function binding(context: Context, node: ESTree.Node, name: string): Variable | undefined {
  let scope: Scope | null = context.sourceCode.getScope(node);
  while (scope !== null) {
    const variable = scope.set.get(name);
    if (variable !== undefined) return variable;
    scope = scope.upper;
  }
  return undefined;
}

function importDefinition(context: Context, node: ESTree.Node, sources: readonly string[]) {
  if (node.type !== "Identifier") return undefined;
  return (binding(context, node, node.name)?.defs ?? []).find(
    (definition) =>
      definition.parent?.type === "ImportDeclaration" && sources.includes(String(definition.parent.source.value)),
  );
}

/**
 * Resolve an identifier (named, default, or namespace member) to the name it is
 * exported under when it is imported from one of the module sources (exact
 * match). Type wrappers and parentheses are looked through; default imports
 * resolve to `"default"`, and a member of a default import counts like a
 * namespace member.
 *
 * See {@link importedSpecifierName} for the strict variant.
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

/**
 * Resolve `node` to the exported name it refers to when it is a named import
 * (`import { a as b }`) or a member of a namespace import (`ns.a`) from a module
 * source accepted by `isSource`. Unlike {@link importedNameFrom}, the node is
 * taken as written (no unwrapping) and default imports never match.
 */
export function importedSpecifierName(
  context: Context,
  node: ESTree.Node,
  isSource: (source: string) => boolean,
): string | undefined {
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
        isSource(String(definition.parent.source.value)),
    );
    return namespace ? node.property.name : undefined;
  }
  if (node.type !== "Identifier") return undefined;
  for (const definition of binding(context, node, node.name)?.defs ?? []) {
    if (
      definition.node.type !== "ImportSpecifier" ||
      definition.parent?.type !== "ImportDeclaration" ||
      !isSource(String(definition.parent.source.value))
    )
      continue;
    const imported = definition.node.imported;
    return imported.type === "Identifier" ? imported.name : String(imported.value);
  }
  return undefined;
}

/** First rule option when it is an object, otherwise an empty object. */
export function optionsObject(context: Context): Readonly<Record<string, unknown>> {
  const candidate = (context as { readonly options?: readonly unknown[] }).options?.[0];
  return typeof candidate === "object" && candidate !== null ? (candidate as Record<string, unknown>) : {};
}
