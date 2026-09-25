import type { Context, ESTree, Scope } from "@oxlint/plugins";

/** Resolves Vitest and fast-check imports and unshadowed configured test globals. */
export function testApi(context: Context, node: ESTree.Node): string | undefined {
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    const parent = testApi(context, node.object);
    if (parent === "vitest") return node.property.name;
    if (parent === "fast-check") return `fc.${node.property.name}`;
    if (parent === "vi") return `vi.${node.property.name}`;
    return undefined;
  }
  if (node.type !== "Identifier") return undefined;
  let scope: Scope | null = context.sourceCode.getScope(node);
  while (scope !== null) {
    const variable = scope.set.get(node.name);
    if (variable !== undefined && variable.defs.length > 0) {
      for (const definition of variable.defs) {
        if (definition.parent?.type !== "ImportDeclaration" || definition.parent.importKind === "type") continue;
        const source = definition.parent.source.value;
        if (!["vitest", "fast-check", "@fast-check/vitest"].includes(String(source))) continue;
        if (definition.node.type === "ImportNamespaceSpecifier" || definition.node.type === "ImportDefaultSpecifier")
          return source === "fast-check" ? "fast-check" : "vitest";
        if (definition.node.type === "ImportSpecifier" && definition.node.importKind !== "type") {
          const name =
            definition.node.imported.type === "Identifier"
              ? definition.node.imported.name
              : definition.node.imported.value;
          return source === "fast-check" ? `fc.${name}` : String(name);
        }
      }
      return undefined;
    }
    scope = scope.upper;
  }
  if (["it", "test", "expect", "vi"].includes(node.name)) return node.name;
  return node.name === "fc" ? "fast-check" : undefined;
}

/** Follows Vitest's modifiers and curried each/skipIf forms to the owning test API. */
export function isTestCall(context: Context, node: ESTree.CallExpression): boolean {
  const callback = node.arguments.at(-1);
  if (callback?.type !== "ArrowFunctionExpression" && callback?.type !== "FunctionExpression") return false;
  let callee: ESTree.Node = node.callee;
  for (;;) {
    const name = testApi(context, callee);
    if (name === "it" || name === "test") return true;
    if (callee.type === "MemberExpression") callee = callee.object;
    else if (callee.type === "CallExpression") callee = callee.callee;
    else if (callee.type === "TaggedTemplateExpression") callee = callee.tag;
    else return false;
  }
}
