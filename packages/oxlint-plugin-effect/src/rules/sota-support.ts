import type { Context, ESTree } from "@oxlint/plugins";
import { binding } from "./binding-support.js";

export type ParentNode = ESTree.Node & {
  readonly parent?: ParentNode | null;
};

export type FunctionNode = ParentNode & {
  readonly type: "ArrowFunctionExpression" | "FunctionDeclaration" | "FunctionExpression";
  readonly params: readonly ESTree.Node[];
  readonly body: ESTree.Node | null;
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

export function nearestFunction(node: ESTree.Node): FunctionNode | undefined {
  let current = parentOf(node);
  while (current !== undefined) {
    if (isFunctionNode(current)) return current;
    current = parentOf(current);
  }
  return undefined;
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
      current.type === "ParenthesizedExpression"
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

export function stringLiteralValue(node: ESTree.Node | null | undefined): string | undefined {
  if (node === null || node === undefined) return undefined;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/**
 * Recognize an `effect` module namespace such as `Layer` or `Schema`, whether it
 * is a named import from `effect`, a namespace import from `effect/<Module>`,
 * or an unbound global-style reference. Local shadows never match.
 */
function isModuleNamespace(context: Context, node: ESTree.Node, moduleName: string): boolean {
  if (node.type !== "Identifier") return false;
  const variable = binding(context, node, node.name);
  if (variable === undefined) return node.name === moduleName;
  return variable.defs.some((definition) => {
    if (definition.parent?.type !== "ImportDeclaration") return false;
    const source = definition.parent.source.value;
    if (definition.node.type === "ImportNamespaceSpecifier") return source === `effect/${moduleName}`;
    if (definition.node.type !== "ImportSpecifier" || source !== "effect") return false;
    const imported = definition.node.imported;
    return imported.type === "Identifier" && imported.name === moduleName;
  });
}

/** Return the member name of `<Module>.<member>` when the object resolves to that effect module. */
export function moduleMethod(context: Context, node: ESTree.Node, moduleName: string): string | undefined {
  if (
    node.type !== "MemberExpression" ||
    node.computed ||
    node.property.type !== "Identifier" ||
    !isModuleNamespace(context, node.object, moduleName)
  )
    return undefined;
  return node.property.name;
}

/** True when the identifier resolves to no local binding, i.e. it is the ambient global. */
export function isUnshadowedGlobal(context: Context, node: ESTree.Node, name: string): boolean {
  if (node.type !== "Identifier" || node.name !== name) return false;
  const variable = binding(context, node, name);
  return variable === undefined || variable.defs.length === 0;
}

/** Depth-first walk over child nodes; return `false` from the visitor to skip a subtree. */
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

function isNode(value: unknown): value is ESTree.Node {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/** True when the function's first parameter is absent or never read in its body. */
export function ignoresFirstParameter(context: Context, fn: FunctionNode): boolean {
  const first = fn.params[0];
  if (first === undefined) return true;
  const variables = context.sourceCode.getDeclaredVariables(fn);
  const declared = variables.filter((variable) =>
    variable.identifiers.some((identifier) => isWithin(identifier, first)),
  );
  if (declared.length === 0) return false;
  return declared.every((variable) => variable.references.every((reference) => !reference.isRead()));
}

function isWithin(inner: ESTree.Node, outer: ESTree.Node): boolean {
  return inner.range[0] >= outer.range[0] && inner.range[1] <= outer.range[1];
}

export function optionsObject(context: Context): Readonly<Record<string, unknown>> {
  const candidate = (context as { readonly options?: readonly unknown[] }).options?.[0];
  return typeof candidate === "object" && candidate !== null ? (candidate as Record<string, unknown>) : {};
}

export function stringArrayOption(
  options: Readonly<Record<string, unknown>>,
  name: string,
  fallback: readonly string[],
): readonly string[] {
  const value = options[name];
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : fallback;
}

export function booleanOption(options: Readonly<Record<string, unknown>>, name: string, fallback: boolean): boolean {
  const value = options[name];
  return typeof value === "boolean" ? value : fallback;
}

export function propertyNamed(node: ESTree.Node | undefined, name: string): ESTree.ObjectProperty | undefined {
  if (node?.type !== "ObjectExpression") return undefined;
  for (const property of node.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const key = property.key;
    if ((key.type === "Identifier" && key.name === name) || (key.type === "Literal" && key.value === name))
      return property;
  }
  return undefined;
}
