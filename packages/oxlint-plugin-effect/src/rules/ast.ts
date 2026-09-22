import type { ESTree } from "@oxlint/plugins";

export type IdentifierLike = ESTree.Node & {
  readonly type: "Identifier";
  readonly name: string;
};

export function isIdentifier(node: ESTree.Node | undefined, name?: string): node is IdentifierLike {
  return node?.type === "Identifier" && "name" in node && (name === undefined || node.name === name);
}

export function hasPropertyNamed(node: ESTree.Node | undefined, name: string): boolean {
  if (node?.type !== "ObjectExpression") return false;

  return node.properties.some((property) => {
    if (property.type !== "Property") return false;

    const key = property.key;
    return isIdentifier(key, name) || (key.type === "Literal" && key.value === name);
  });
}

export type SourceContext = {
  readonly sourceCode?: { getText: () => string };
  readonly getSourceCode?: () => { getText: () => string };
};

export function getSourceText(context: SourceContext): string | undefined {
  return context.sourceCode?.getText() ?? context.getSourceCode?.().getText();
}
