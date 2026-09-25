import type { ESTree } from "@oxlint/plugins";

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
