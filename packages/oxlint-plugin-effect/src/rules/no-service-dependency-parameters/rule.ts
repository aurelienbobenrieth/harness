import type { ESTree, Rule } from "@oxlint/plugins";

/** Namespaces whose `Service` member is a tag or constructor type, not the instance a tag yields. */
const tagNamespaces: ReadonlySet<string> = new Set(["Context", "Effect", "Layer", "ServiceMap"]);

/** A `Service` member of a lowercase namespace (`ecs.Service`) is a domain type from an SDK, not a service projection. */
function isProjection(name: ESTree.TSQualifiedName): boolean {
  if (name.right.name !== "Service") return false;
  if (name.left.type === "TSQualifiedName") return true;
  if (name.left.type !== "Identifier") return false;
  return /^[A-Z]/u.test(name.left.name) && !tagNamespaces.has(name.left.name);
}

function serviceType(type: ESTree.TSType, configured: readonly string[]): boolean {
  if (type.type === "TSTypeReference") {
    if (type.typeName.type === "Identifier") return configured.includes(type.typeName.name);
    return type.typeName.type === "TSQualifiedName" && isProjection(type.typeName);
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
    docs: {
      description:
        'Disallow service projection types (`UserRepo["Service"]`, `UserRepo.Service`) and configured service names in parameters; `Context.Service` tag types and lowercase SDK namespaces are not projections.',
    },
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
