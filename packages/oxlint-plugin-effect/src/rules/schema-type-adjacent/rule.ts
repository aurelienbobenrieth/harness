import type { ESTree, Rule } from "@oxlint/plugins";
import { isModuleNamespace } from "../binding-support.js";

function schemaName(type: ESTree.TSType): string | undefined {
  if (
    type.type === "TSTypeQuery" &&
    type.exprName.type === "TSQualifiedName" &&
    ["Type", "Encoded"].includes(type.exprName.right.name) &&
    type.exprName.left.type === "Identifier"
  )
    return type.exprName.left.name;
  if (
    type.type === "TSTypeReference" &&
    type.typeName.type === "TSQualifiedName" &&
    ["Type", "Encoded"].includes(type.typeName.right.name)
  ) {
    const argument = type.typeArguments?.params[0];
    if (argument?.type === "TSTypeQuery" && argument.exprName.type === "Identifier") return argument.exprName.name;
  }
  return undefined;
}

export const schemaTypeAdjacent: Rule = {
  meta: {
    type: "layout",
    docs: {
      description: "Keep a Schema's matching type alias adjacent, allowing whitespace and JSDoc.",
    },
    messages: {
      schemaTypeAdjacent:
        "Place the Schema type alias immediately after its schema declaration; documentation may separate them.",
    },
  },
  createOnce(context) {
    return {
      Program(program) {
        const declarations = new Map<string, number>();
        for (const [index, statement] of program.body.entries()) {
          const node = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
          if (node?.type === "VariableDeclaration")
            for (const declaration of node.declarations) {
              if (
                declaration.id.type === "Identifier" &&
                declaration.init?.type === "CallExpression" &&
                declaration.init.callee.type === "MemberExpression" &&
                isModuleNamespace(context, declaration.init.callee.object, "Schema")
              )
                declarations.set(declaration.id.name, index);
            }
          if (node?.type !== "TSTypeAliasDeclaration" || schemaName(node.typeAnnotation) !== node.id.name) continue;
          const previous = declarations.get(node.id.name);
          if (previous !== undefined && previous !== index - 1)
            context.report({ node, messageId: "schemaTypeAdjacent" });
        }
      },
    };
  },
};
