import type { ESTree, Rule } from "@oxlint/plugins";

const message = "Export immutable contracts or factories instead of mutable module state.";

type VariableDeclaration = ESTree.VariableDeclaration & {
  readonly declarations: readonly VariableDeclarator[];
  readonly kind: "const" | "let" | "var";
};

type VariableDeclarator = ESTree.VariableDeclarator & {
  readonly id: ESTree.Node;
  readonly init?: ESTree.Node | null;
};

type ExportNamedDeclaration = ESTree.Node & {
  readonly declaration?: ESTree.Node | null;
  readonly specifiers?: readonly ExportSpecifier[];
};

type ExportSpecifier = ESTree.Node & {
  readonly local?: ESTree.Node;
};

const mutableConstructors = new Set(["Date", "Map", "Set", "WeakMap", "WeakSet"]);

function isIdentifier(node: ESTree.Node | undefined, name?: string): node is ESTree.Identifier {
  return node?.type === "Identifier" && (name === undefined || node.name === name);
}

function isVariableDeclaration(node: ESTree.Node | undefined | null): node is VariableDeclaration {
  return node?.type === "VariableDeclaration";
}

function isMutableInitializer(node: ESTree.Node | undefined | null): boolean {
  if (node === undefined || node === null) return false;
  if (node.type === "ArrayExpression" || node.type === "ObjectExpression") return true;

  return node.type === "NewExpression" && isIdentifier(node.callee) && mutableConstructors.has(node.callee.name);
}

function mutableDeclaratorNames(declaration: VariableDeclaration): readonly string[] {
  if (declaration.kind !== "let" && declaration.kind !== "var") {
    return declaration.declarations
      .filter((declarator) => isMutableInitializer(declarator.init))
      .flatMap((declarator) => (isIdentifier(declarator.id) ? [declarator.id.name] : []));
  }

  return declaration.declarations.flatMap((declarator) => (isIdentifier(declarator.id) ? [declarator.id.name] : []));
}

function getExportedLocalNames(node: ExportNamedDeclaration): readonly string[] {
  return (node.specifiers ?? []).flatMap((specifier) => (isIdentifier(specifier.local) ? [specifier.local.name] : []));
}

export const noMutableExportedState: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow exporting mutable module state.",
    },
    messages: {
      noMutableExportedState: message,
    },
  },
  createOnce(context) {
    const mutableBindings = new Set<string>();

    return {
      VariableDeclaration(node: VariableDeclaration) {
        for (const name of mutableDeclaratorNames(node)) {
          mutableBindings.add(name);
        }
      },
      ExportNamedDeclaration(node: ExportNamedDeclaration) {
        if (isVariableDeclaration(node.declaration) && mutableDeclaratorNames(node.declaration).length > 0) {
          context.report({ node, messageId: "noMutableExportedState" });
          return;
        }

        if (getExportedLocalNames(node).some((name) => mutableBindings.has(name))) {
          context.report({ node, messageId: "noMutableExportedState" });
        }
      },
    };
  },
};
