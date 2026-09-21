import type { Context, ESTree, Rule, Scope, Variable } from "@oxlint/plugins";

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;
type IdentifierNode = Extract<ESTree.Node, { type: "Identifier" }>;

function variableAt(context: Context, node: IdentifierNode): Variable | undefined {
  let scope: Scope | null = context.sourceCode.getScope(node);
  while (scope !== null) {
    const variable = scope.set.get(node.name);
    if (variable !== undefined) return variable;
    scope = scope.upper;
  }
  return undefined;
}

function isPublic(node: FunctionNode, exported: ReadonlySet<ESTree.Node>): boolean {
  if (exported.has(node)) return true;
  const parent = node.parent;
  if (parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration") return true;
  return (
    parent.type === "VariableDeclarator" &&
    parent.parent.type === "VariableDeclaration" &&
    parent.parent.parent.type === "ExportNamedDeclaration"
  );
}

function objectType(type: ESTree.TSType): boolean {
  if (type.type === "TSTypeLiteral") return true;
  if (type.type === "TSUnionType" || type.type === "TSIntersectionType") return type.types.some(objectType);
  if (type.type === "TSParenthesizedType") return objectType(type.typeAnnotation);
  if (type.type === "TSTypeReference" && type.typeName.type === "Identifier" && type.typeName.name === "Promise")
    return type.typeArguments?.params.some(objectType) ?? false;
  return false;
}

export const noExportedAnonymousObjectReturn: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require named object return contracts for functions exported directly, by local alias, or as a default identifier.",
    },
    messages: {
      namedReturn: "Name the exported object return contract and annotate the public function.",
    },
  },
  create(context) {
    const exported = new Set<ESTree.Node>();
    const overloads = new Set<string>();
    const expose = (identifier: IdentifierNode, seen = new Set<Variable>()): void => {
      const variable = variableAt(context, identifier);
      if (variable === undefined || seen.has(variable)) return;
      seen.add(variable);
      for (const definition of variable.defs) {
        if (definition.node.type === "FunctionDeclaration" || definition.node.type === "TSDeclareFunction")
          exported.add(definition.node);
        if (definition.node.type !== "VariableDeclarator") continue;
        const initial = definition.node.init;
        if (initial?.type === "ArrowFunctionExpression" || initial?.type === "FunctionExpression")
          exported.add(initial);
        if (
          initial?.type === "Identifier" &&
          definition.node.parent.type === "VariableDeclaration" &&
          definition.node.parent.kind === "const"
        )
          expose(initial, seen);
      }
    };
    const check = (node: FunctionNode): void => {
      if (!isPublic(node, exported)) return;
      if (node.returnType && objectType(node.returnType.typeAnnotation))
        context.report({ node: node.returnType, messageId: "namedReturn" });
      else if (!node.returnType && node.type === "ArrowFunctionExpression" && node.body.type === "ObjectExpression")
        context.report({ node: node.body, messageId: "namedReturn" });
    };
    return {
      Program(node) {
        for (const statement of node.body) {
          const declaration =
            statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
              ? statement.declaration
              : statement;
          if (declaration?.type === "TSDeclareFunction" && declaration.id && declaration.returnType)
            overloads.add(declaration.id.name);
          if (
            statement.type === "ExportNamedDeclaration" &&
            statement.source === null &&
            statement.exportKind !== "type"
          )
            for (const specifier of statement.specifiers)
              if (specifier.local.type === "Identifier" && specifier.exportKind !== "type") expose(specifier.local);
          if (statement.type === "ExportDefaultDeclaration" && statement.declaration.type === "Identifier")
            expose(statement.declaration);
        }
      },
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      TSDeclareFunction(node) {
        if (
          (exported.has(node) ||
            node.parent.type === "ExportNamedDeclaration" ||
            node.parent.type === "ExportDefaultDeclaration") &&
          node.returnType &&
          objectType(node.returnType.typeAnnotation)
        )
          context.report({ node: node.returnType, messageId: "namedReturn" });
      },
      ReturnStatement(node) {
        if (node.argument?.type !== "ObjectExpression") return;
        let owner = node.parent;
        while (owner.type !== "Program") {
          if (
            owner.type === "FunctionDeclaration" ||
            owner.type === "FunctionExpression" ||
            owner.type === "ArrowFunctionExpression"
          ) {
            const signatureOwnsReturn =
              owner.type === "FunctionDeclaration" &&
              owner.id &&
              overloads.has(owner.id.name) &&
              (owner.parent.type === "Program" || owner.parent.parent?.type === "Program");
            if (!owner.returnType && !signatureOwnsReturn && isPublic(owner, exported))
              context.report({ node, messageId: "namedReturn" });
            return;
          }
          owner = owner.parent;
        }
      },
    };
  },
};
