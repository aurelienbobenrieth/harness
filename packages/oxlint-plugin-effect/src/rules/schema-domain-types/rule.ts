import type { ESTree, Rule } from "@oxlint/plugins";
import { defaultAllow, isScopedFile, type RuleContextWithOptions } from "../runtime-support.js";

const defaultFiles = ["**/domain/**"];

// Namespaces whose types are runtime handles (a codec, an effect, a service), not data a Schema describes.
const runtimeNamespaces = new Set(["Context", "Effect", "Fiber", "Layer", "Queue", "Ref", "Schema", "Scope", "Stream"]);

// Wrappers that keep the shape they wrap: `Readonly<{ id: string }>` is still a hand-written object.
const shapeWrappers = new Set(["Array", "NonNullable", "Partial", "Readonly", "ReadonlyArray", "Required"]);

function leftmostName(name: ESTree.TSTypeName): string | undefined {
  if (name.type === "Identifier") return name.name;
  if (name.type === "TSQualifiedName") return leftmostName(name.left);
  return undefined;
}

function rightName(name: ESTree.TSTypeName): string | undefined {
  if (name.type === "Identifier") return name.name;
  if (name.type === "TSQualifiedName") return name.right.name;
  return undefined;
}

// Schema's JSON value types (`Schema.Json`, `Schema.MutableJsonObject`) are data, not codecs.
const schemaDataType = /^(?:Mutable)?Json/u;

function isRuntimeHandle(type: ESTree.TSType): boolean {
  if (type.type === "TSFunctionType" || type.type === "TSConstructorType") return true;
  if (type.type === "TSTypeReference") {
    if (type.typeName.type !== "TSQualifiedName") return false;
    const namespace = leftmostName(type.typeName);
    if (namespace === "Schema" && schemaDataType.test(type.typeName.right.name)) return false;
    return namespace !== undefined && runtimeNamespaces.has(namespace);
  }
  if (type.type === "TSUnionType" || type.type === "TSIntersectionType") return type.types.some(isRuntimeHandle);
  if (type.type === "TSTypeOperator") return isRuntimeHandle(type.typeAnnotation);
  return false;
}

// A member that is behavior or a runtime handle makes the declaration a record of capabilities, which no Schema
// describes; the rule leaves it alone.
function holdsBehavior(members: readonly ESTree.TSSignature[]): boolean {
  return members.some((member) => {
    if (member.type !== "TSPropertySignature") return member.type !== "TSIndexSignature";
    const annotation = member.typeAnnotation?.typeAnnotation;
    return annotation !== undefined && isRuntimeHandle(annotation);
  });
}

type Shape = "literals" | "object" | undefined;

function strongest(shapes: readonly Shape[]): Shape {
  if (shapes.includes("object")) return "object";
  return shapes.includes("literals") ? "literals" : undefined;
}

function tupleElementShape(element: ESTree.TSTupleElement): Shape {
  if (element.type === "TSNamedTupleMember") return tupleElementShape(element.elementType);
  if (element.type === "TSOptionalType" || element.type === "TSRestType") return shapeOf(element.typeAnnotation);
  return shapeOf(element);
}

function shapeOf(type: ESTree.TSType): Shape {
  if (type.type === "TSTypeLiteral") return holdsBehavior(type.members) ? undefined : "object";
  if (type.type === "TSLiteralType" || type.type === "TSTemplateLiteralType") return "literals";
  if (type.type === "TSUnionType" || type.type === "TSIntersectionType") return strongest(type.types.map(shapeOf));
  if (type.type === "TSArrayType") return shapeOf(type.elementType);
  if (type.type === "TSTypeOperator" && type.operator === "readonly") return shapeOf(type.typeAnnotation);
  if (type.type === "TSTupleType") return strongest(type.elementTypes.map(tupleElementShape));
  if (type.type === "TSTypeReference") {
    const name = rightName(type.typeName);
    const [argument] = type.typeArguments?.params ?? [];
    if (type.typeName.type === "Identifier" && name !== undefined && shapeWrappers.has(name) && argument !== undefined)
      return shapeOf(argument);
  }
  return undefined;
}

function isSchemaDerivedInterface(node: ESTree.TSInterfaceDeclaration): boolean {
  return node.body.body.length === 0 && node.extends.length > 0;
}

export const schemaDomainTypes: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require domain types to be declared as Schemas, with the TypeScript type derived from them, instead of interfaces, object types, literal unions or enums.",
    },
    messages: {
      schemaDomainObject:
        "Declare this domain type as a Schema (Schema.Struct, Schema.TaggedStruct, a Schema.Union of them) and derive it with `type {{name}} = typeof {{name}}.Type`.",
      schemaDomainLiterals:
        "Declare these domain literals as Schema.Literals([...]) and derive the type with `type {{name}} = typeof {{name}}.Type`.",
      schemaDomainEnum:
        "Declare this domain enum as Schema.Literals([...]) and derive the type with `type {{name}} = typeof {{name}}.Type`.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
          files: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: defaultAllow, files: defaultFiles }],
  },
  createOnce(context) {
    const inScope = (): boolean =>
      isScopedFile(context as RuleContextWithOptions, { allow: defaultAllow, files: defaultFiles });

    return {
      TSInterfaceDeclaration(node) {
        if (node.typeParameters !== null || node.declare || isSchemaDerivedInterface(node)) return;
        if (holdsBehavior(node.body.body) || !inScope()) return;
        context.report({ node: node.id, messageId: "schemaDomainObject", data: { name: node.id.name } });
      },
      TSTypeAliasDeclaration(node) {
        if (node.typeParameters !== null || node.declare) return;
        const shape = shapeOf(node.typeAnnotation);
        if (shape === undefined || !inScope()) return;
        context.report({
          node: node.id,
          messageId: shape === "object" ? "schemaDomainObject" : "schemaDomainLiterals",
          data: { name: node.id.name },
        });
      },
      TSEnumDeclaration(node) {
        if (node.declare || !inScope()) return;
        context.report({ node: node.id, messageId: "schemaDomainEnum", data: { name: node.id.name } });
      },
    };
  },
};
