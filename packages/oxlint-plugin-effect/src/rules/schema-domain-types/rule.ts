import type { ESTree, Rule } from "@oxlint/plugins";
import { defaultAllow, getFilename, isAllowedFile, type RuleContextWithOptions } from "../runtime-support.js";

const defaultFiles = ["**/domain/**"];

// Namespaces whose types are runtime handles (a codec, an effect, a service), not data a Schema describes.
const runtimeNamespaces = new Set(["Context", "Effect", "Fiber", "Layer", "Queue", "Ref", "Schema", "Scope", "Stream"]);

// Wrappers that keep the shape they wrap: `Readonly<{ id: string }>` is still a hand-written object.
const shapeWrappers = new Set(["Array", "NonNullable", "Partial", "Readonly", "ReadonlyArray", "Required"]);

type Options = {
  readonly allow: readonly string[];
  readonly files: readonly string[];
};

function stringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : undefined;
}

function optionsOf(context: RuleContextWithOptions): Options {
  const candidate = context.options?.[0];
  const record = typeof candidate === "object" && candidate !== null ? (candidate as Record<string, unknown>) : {};
  return {
    allow: stringArray(record.allow) ?? defaultAllow,
    files: stringArray(record.files) ?? defaultFiles,
  };
}

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

function isRuntimeHandle(type: ESTree.TSType): boolean {
  if (type.type === "TSFunctionType" || type.type === "TSConstructorType") return true;
  if (type.type === "TSTypeReference") {
    const namespace = leftmostName(type.typeName);
    return type.typeName.type === "TSQualifiedName" && namespace !== undefined && runtimeNamespaces.has(namespace);
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
    const inScope = (): boolean => {
      const options = optionsOf(context as RuleContextWithOptions);
      const filename = getFilename(context as RuleContextWithOptions);
      return isAllowedFile(filename, options.files) && !isAllowedFile(filename, options.allow);
    };

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
