import type { ESTree } from "@oxlint/plugins";

export type IdentifierLike = ESTree.Node & {
  readonly type: "Identifier";
  readonly name: string;
};

export function isIdentifier(node: ESTree.Node | undefined, name?: string): node is IdentifierLike {
  return node?.type === "Identifier" && "name" in node && (name === undefined || node.name === name);
}

export function isMemberExpression(
  node: ESTree.Node | undefined,
  objectName: string,
  propertyName: string,
): node is ESTree.MemberExpression {
  return (
    node?.type === "MemberExpression" &&
    isIdentifier(node.object, objectName) &&
    isIdentifier(node.property, propertyName)
  );
}

export function isJsonMethodCall(
  node: ESTree.Node | undefined,
  methodName: "parse" | "stringify",
): node is ESTree.CallExpression {
  return node?.type === "CallExpression" && isMemberExpression(node.callee, "JSON", methodName);
}

export function isImmediateFunctionCallWithArgument(
  node: ESTree.Node | undefined,
  argumentNode: ESTree.CallExpression,
  predicate: (callee: ESTree.Node) => boolean,
): boolean {
  if (node?.type !== "CallExpression") return false;
  if (!node.arguments.includes(argumentNode)) return false;

  return predicate(node.callee);
}
