import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

type Identifier = Extract<ESTree.Node, { type: "Identifier" }>;

const functionTypes = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

export function isFunctionNode(node: ESTree.Node): boolean {
  return functionTypes.has(node.type);
}

export function enclosingFunction(node: ESTree.Node): ESTree.Node | undefined {
  let current: ESTree.Node | null | undefined = node.parent;
  while (current) {
    if (isFunctionNode(current)) return current;
    current = current.parent;
  }
  return undefined;
}

/**
 * Dotted path of a non-computed member chain, e.g. `shopify.authenticate.admin`. `this` is rendered
 * as `this`; any other root or a computed segment yields `undefined`.
 */
export function memberPath(node: ESTree.Node): readonly string[] | undefined {
  if (node.type === "Identifier") return [node.name];
  if (node.type === "ThisExpression") return ["this"];
  if (node.type !== "MemberExpression" || node.computed || node.property.type !== "Identifier") return undefined;
  const owner = memberPath(node.object);
  return owner === undefined ? undefined : [...owner, node.property.name];
}

export function resolveVariable(context: Context, identifier: Identifier): Variable | undefined {
  let scope: Scope | null = context.sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined && variable.defs.length > 0) return variable;
    scope = scope.upper;
  }
  return undefined;
}

export function unshadowed(context: Context, identifier: Identifier): boolean {
  return resolveVariable(context, identifier) === undefined;
}

function unwrapAwait(node: ESTree.Node | null | undefined): ESTree.Node | undefined {
  let current = node ?? undefined;
  while (
    current?.type === "AwaitExpression" ||
    current?.type === "TSNonNullExpression" ||
    current?.type === "TSAsExpression"
  )
    current = current.type === "AwaitExpression" ? current.argument : current.expression;
  return current;
}

/** True when `node` calls `authenticate.<member>` on any owner, e.g. `shopify.authenticate.webhook(request)`. */
export function isAuthenticateCall(node: ESTree.Node | undefined, members: ReadonlySet<string>): boolean {
  if (node?.type !== "CallExpression") return false;
  const path = memberPath(node.callee);
  if (path === undefined || path.length < 2) return false;
  return path.at(-2) === "authenticate" && members.has(path.at(-1) ?? "");
}

/** True when the identifier is destructured directly from a call accepted by `accepts`. */
export function destructuredFrom(
  context: Context,
  identifier: Identifier,
  accepts: (init: ESTree.Node | undefined) => boolean,
): boolean {
  const definition = resolveVariable(context, identifier)?.defs[0];
  const declarator = definition?.node;
  if (definition?.type !== "Variable" || declarator?.type !== "VariableDeclarator") return false;
  return declarator.id.type === "ObjectPattern" && accepts(unwrapAwait(declarator.init));
}

const testFilePattern =
  /(?:^|\/)(?:__tests__|__mocks__|__fixtures__|fixtures?|tests?)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;

export function isTestFile(context: Context): boolean {
  return testFilePattern.test(context.filename.replaceAll("\\", "/"));
}
