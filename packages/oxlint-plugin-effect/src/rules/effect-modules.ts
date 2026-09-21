import type { ESTree } from "@oxlint/plugins";
import { isIdentifier } from "./ast.js";

function isEffectModuleSpecifier(specifier: string): boolean {
  return specifier === "effect" || specifier.startsWith("effect/") || specifier.startsWith("@effect/");
}

export function hasEffectImport(program: ESTree.Program): boolean {
  return program.body.some(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      typeof statement.source.value === "string" &&
      isEffectModuleSpecifier(statement.source.value),
  );
}

export function isLayerProvisionCall(node: ESTree.Node | undefined): node is ESTree.CallExpression {
  return (
    node?.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    isIdentifier(node.callee.object, "Layer") &&
    (isIdentifier(node.callee.property, "provide") || isIdentifier(node.callee.property, "provideMerge"))
  );
}
