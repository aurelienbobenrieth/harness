import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

export type ParentNode = ESTree.Node & {
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

/** True when the file imports from any of the given module sources (exact match). */
function importsFrom(program: ESTree.Node, sources: readonly string[]): boolean {
  if (program.type !== "Program") return false;
  return program.body.some(
    (statement) => statement.type === "ImportDeclaration" && sources.includes(String(statement.source.value)),
  );
}

const handlerNames: ReadonlySet<string> = new Set(["fetch", "queue", "scheduled", "email", "tail", "trace", "test"]);

function isHandlerObject(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);
  if (value.type !== "ObjectExpression") return false;
  return value.properties.some((property) => {
    const name = property.type === "Property" ? propertyKeyName(property) : undefined;
    return name !== undefined && handlerNames.has(name);
  });
}

/**
 * True for a Worker module: it imports `cloudflare:workers`, or its default
 * export is a handler object (`fetch`, `queue`, `scheduled`, ...), directly or
 * through a module-level binding.
 */
export function isWorkerModule(context: Context, program: ESTree.Node): boolean {
  if (program.type !== "Program") return false;
  if (importsFrom(program, ["cloudflare:workers"])) return true;
  return program.body.some((statement) => {
    if (statement.type !== "ExportDefaultDeclaration") return false;
    const declaration = statement.declaration as ESTree.Node;
    if (isHandlerObject(declaration)) return true;
    const value = unwrapExpression(declaration);
    if (value.type !== "Identifier") return false;
    return (binding(context, value, value.name)?.defs ?? []).some(
      (definition) =>
        definition.node.type === "VariableDeclarator" &&
        definition.node.init !== null &&
        definition.node.init !== undefined &&
        isHandlerObject(definition.node.init),
    );
  });
}

type ClassNode = ESTree.Class;

/** True for a class whose superclass is one of `names`, imported from `cloudflare:workers`. */
export function extendsWorkersClass(context: Context, node: ClassNode, names: readonly string[]): boolean {
  if (node.superClass === null || node.superClass === undefined) return false;
  const imported = importedNameFrom(context, node.superClass, ["cloudflare:workers"]);
  return imported !== undefined && names.includes(imported);
}

/** Nearest enclosing class declaration or expression. */
export function enclosingClass(node: ESTree.Node): ClassNode | undefined {
  let current = parentOf(node);
  while (current !== undefined) {
    if (current.type === "ClassDeclaration" || current.type === "ClassExpression") return current;
    current = parentOf(current);
  }
  return undefined;
}

/** Method (`MethodDefinition`) whose value is the given function, if any. */
export function methodOf(fn: ESTree.Node): ESTree.MethodDefinition | undefined {
  const parent = parentOf(fn);
  return parent?.type === "MethodDefinition" && parent.value === fn ? parent : undefined;
}

/** True when `name` resolves to a declaration in the file rather than to the runtime global. */
export function isShadowed(context: Context, node: ESTree.Node, name: string): boolean {
  return (binding(context, node, name)?.defs.length ?? 0) > 0;
}

/** True for a call to `<object>.<method>()` where `<object>` is the global with that name (not shadowed). */
function isGlobalMemberCall(context: Context, node: ESTree.Node, object: string, method: string): boolean {
  if (node.type !== "CallExpression") return false;
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "MemberExpression" || memberPropertyName(callee) !== method) return false;
  const owner = unwrapExpression(callee.object);
  return owner.type === "Identifier" && owner.name === object && !isShadowed(context, owner, object);
}

/**
 * True for a runtime-nondeterministic expression: `Date.now()`, `Math.random()`,
 * `performance.now()`, `crypto.randomUUID()`, `crypto.getRandomValues()`, and
 * `new Date()` / `Date()` without arguments.
 */
export function isNondeterministicCall(context: Context, node: ESTree.Node): boolean {
  if (
    isGlobalMemberCall(context, node, "Date", "now") ||
    isGlobalMemberCall(context, node, "Math", "random") ||
    isGlobalMemberCall(context, node, "performance", "now") ||
    isGlobalMemberCall(context, node, "crypto", "randomUUID") ||
    isGlobalMemberCall(context, node, "crypto", "getRandomValues")
  )
    return true;
  if ((node.type === "NewExpression" || node.type === "CallExpression") && node.arguments.length === 0) {
    const callee = unwrapExpression(node.callee);
    return callee.type === "Identifier" && callee.name === "Date" && !isShadowed(context, callee, "Date");
  }
  return false;
}
