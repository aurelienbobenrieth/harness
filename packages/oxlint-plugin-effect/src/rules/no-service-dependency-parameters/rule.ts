import type { ESTree, Rule } from "@oxlint/plugins";

function serviceType(type: ESTree.TSType, configured: readonly string[]): boolean {
  if (type.type === "TSTypeReference") {
    if (type.typeName.type === "Identifier") return configured.includes(type.typeName.name);
    return type.typeName.type === "TSQualifiedName" && type.typeName.right.name === "Service";
  }
  return (
    type.type === "TSIndexedAccessType" &&
    type.indexType.type === "TSLiteralType" &&
    type.indexType.literal.type === "Literal" &&
    type.indexType.literal.value === "Service"
  );
}

export const noServiceDependencyParameters: Rule = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow service projection types and configured service names in parameters." },
    messages: {
      serviceParameter: "Yield Effect services from context instead of passing service instances through parameters.",
    },
    schema: [
      {
        type: "object",
        properties: { serviceTypeNames: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    const check = (node: ESTree.Function | ESTree.ArrowFunctionExpression): void => {
      const options = context.options[0] as { serviceTypeNames?: string[] } | undefined;
      for (const parameter of node.params) {
        const annotation = "typeAnnotation" in parameter ? parameter.typeAnnotation : undefined;
        if (annotation && serviceType(annotation.typeAnnotation, options?.serviceTypeNames ?? []))
          context.report({ node: annotation, messageId: "serviceParameter" });
      }
    };
    return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check };
  },
};
