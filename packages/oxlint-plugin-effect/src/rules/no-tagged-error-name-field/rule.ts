import type { ESTree, Rule } from "@oxlint/plugins";
import { propertyKeyName, stringLiteralValue } from "@aurelienbbn/oxlint-kit/ast";
import { taggedErrorSuperclass } from "../tagged-error-name/rule.js";

/** Static name of a type member key, written as an identifier or a string literal. */
function keyName(key: ESTree.Node): string | undefined {
  return key.type === "Identifier" ? key.name : stringLiteralValue(key);
}

/** Members of an object type literal or interface body that are named `name`. */
function nameMember(members: readonly ESTree.Node[]): ESTree.Node | undefined {
  return members.find(
    (member) =>
      (member.type === "TSPropertySignature" || member.type === "TSMethodSignature") &&
      !member.computed &&
      keyName(member.key) === "name",
  );
}

/** The `name` member of a payload type: an inline object type, or a same-file interface or type alias by reference. */
function payloadNameMember(program: ESTree.Program, type: ESTree.TSType, seen: Set<string>): ESTree.Node | undefined {
  if (type.type === "TSTypeLiteral") return nameMember(type.members);
  if (type.type === "TSTypeReference" && type.typeName.type === "Identifier") {
    const name = type.typeName.name;
    if (seen.has(name)) return undefined;
    seen.add(name);
    for (const statement of program.body) {
      const declaration =
        (statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration") &&
        statement.declaration !== null &&
        statement.declaration !== undefined
          ? statement.declaration
          : statement;
      if (declaration.type === "TSInterfaceDeclaration" && declaration.id.name === name)
        return nameMember(declaration.body.body);
      if (declaration.type === "TSTypeAliasDeclaration" && declaration.id.name === name)
        return payloadNameMember(program, declaration.typeAnnotation, seen);
    }
  }
  return undefined;
}

/** The `name` property of a `Schema.TaggedError<Self>()(tag, { fields })` field object. */
function fieldsNameProperty(fields: ESTree.Node | undefined): ESTree.Node | undefined {
  if (fields?.type !== "ObjectExpression") return undefined;
  return fields.properties.find((property) => property.type === "Property" && propertyKeyName(property) === "name");
}

/**
 * Keep a tagged error's payload from shadowing `Error.name`: a field called `name` overwrites the error's own `name`
 * (the class name stack traces and loggers print), so the payload names what it identifies (`queueName`,
 * `domainName`).
 *
 * @attribution crosshatch/traits by Harry Solovay (Apache-2.0; idea only, independently implemented)
 */
export const noTaggedErrorNameField: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a field named name in the payload of a Schema.TaggedError, Schema.TaggedErrorClass, or Data.TaggedError class, which shadows Error.name.",
    },
    messages: {
      shadowsErrorName:
        'Rename the field "name" of the tagged error "{{error}}": it shadows Error.name. Use a domain-specific field such as "queueName" or "domainName".',
    },
    schema: [],
  },
  createOnce(context) {
    let program: ESTree.Program | undefined;

    function check(node: ESTree.Class): void {
      if (program === undefined || node.id === null || node.superClass === null) return;
      const superclass = taggedErrorSuperclass(context, node.superClass);
      if (superclass === undefined) return;

      const fromType = (node.superTypeArguments?.params ?? [])
        .map((type) => payloadNameMember(program as ESTree.Program, type, new Set()))
        .find((member) => member !== undefined);
      const offender = fieldsNameProperty(superclass.call.arguments[1]) ?? fromType;
      if (offender !== undefined)
        context.report({ node: offender, messageId: "shadowsErrorName", data: { error: node.id.name } });
    }

    return {
      Program(node: ESTree.Program) {
        program = node;
      },
      ClassDeclaration: check,
      ClassExpression: check,
    };
  },
};
