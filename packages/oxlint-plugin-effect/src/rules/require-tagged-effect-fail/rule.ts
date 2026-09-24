import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { binding } from "@aurelienbbn/oxlint-kit/ast";
import { effectMethod } from "../binding-support.js";

const message =
  "Fail Effects with a tagged domain error (Schema.TaggedError, Data.TaggedError, or an object with a literal _tag) instead of an untagged literal or a native Error subclass.";
const disallowedArgumentTypes = new Set(["ArrayExpression", "Literal", "ObjectExpression", "TemplateLiteral"]);

function hasRawFailureValue(node: ESTree.Node | undefined): boolean {
  if (
    node?.type === "ObjectExpression" &&
    node.properties.some(
      (property) =>
        property.type === "Property" &&
        !property.computed &&
        property.key.type === "Identifier" &&
        property.key.name === "_tag" &&
        property.value.type === "Literal" &&
        typeof property.value.value === "string" &&
        property.value.value.trim() !== "",
    )
  )
    return false;
  return node !== undefined && disallowedArgumentTypes.has(node.type);
}

const nativeErrorNames = new Set([
  "Error",
  "AggregateError",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
]);

function declaresTag(node: ESTree.Class): boolean {
  return node.body.body.some(
    (member) =>
      member.type === "PropertyDefinition" &&
      !member.computed &&
      ((member.key.type === "Identifier" && member.key.name === "_tag") ||
        (member.key.type === "Literal" && member.key.value === "_tag")),
  );
}

/** Resolve same-file class chains that end at a native Error without ever declaring a `_tag` member. */
function isUntaggedNativeError(context: Context, callee: ESTree.Node, seen = new Set<ESTree.Node>()): boolean {
  if (callee.type !== "Identifier") return false;
  const variable = binding(context, callee, callee.name);
  if (variable === undefined || variable.defs.length === 0) return nativeErrorNames.has(callee.name);

  return variable.defs.some((definition) => {
    const declaration = definition.node;
    if (declaration.type !== "ClassDeclaration" && declaration.type !== "ClassExpression") return false;
    if (seen.has(declaration) || declaration.superClass === null || declaresTag(declaration)) return false;
    seen.add(declaration);
    return isUntaggedNativeError(context, declaration.superClass, seen);
  });
}

function lazyFailureValue(node: ESTree.Node | undefined): ESTree.Node | undefined {
  if (node?.type !== "ArrowFunctionExpression" && node?.type !== "FunctionExpression") return undefined;
  if (node.body === null) return undefined;
  if (node.body.type !== "BlockStatement") return node.body;

  const [statement, ...rest] = node.body.body;
  return rest.length === 0 && statement?.type === "ReturnStatement" ? (statement.argument ?? undefined) : undefined;
}

export const requireTaggedEffectFail: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require tagged error values for Effect.fail and Effect.failSync, rejecting literals, native Errors, and same-file untagged Error subclasses.",
    },
    messages: {
      typedFailure: message,
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const method = effectMethod(context, node.callee);
        if (method !== "fail" && method !== "failSync") return;
        let value: ESTree.Node | undefined =
          method === "failSync" ? lazyFailureValue(node.arguments[0]) : node.arguments[0];
        const seen = new Set<ESTree.Node>();
        while (value?.type === "Identifier" && !seen.has(value)) {
          seen.add(value);
          const declaration: ESTree.Node | undefined = binding(context, value, value.name)?.defs.find(
            (definition) => definition.node.type === "VariableDeclarator",
          )?.node;
          if (declaration?.type !== "VariableDeclarator" || declaration.init === null) break;
          value = declaration.init;
        }
        const genericError = value?.type === "NewExpression" && isUntaggedNativeError(context, value.callee);
        if (!genericError && !hasRawFailureValue(value)) return;

        context.report({
          node,
          messageId: "typedFailure",
        });
      },
    };
  },
};
