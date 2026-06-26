import type { ESTree } from "@oxlint/plugins";

export type IdentifierLike = ESTree.Node & {
  readonly type: "Identifier";
  readonly name: string;
};

export function isIdentifier(node: ESTree.Node | undefined, name?: string): node is IdentifierLike {
  return node?.type === "Identifier" && "name" in node && (name === undefined || node.name === name);
}

export function isJsonMethodCall(
  node: ESTree.Node | undefined,
  methodName: "parse" | "stringify",
): node is ESTree.CallExpression {
  return (
    node?.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    isIdentifier(node.callee.object, "JSON") &&
    isIdentifier(node.callee.property, methodName)
  );
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
